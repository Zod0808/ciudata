// [Cada Lunes - 08:00] Habilita el bloque de encuesta semanal (4 preguntas, 7 días).
// Cron: "0 8 * * 1"
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const db = require('../db');

// Banco de preguntas por semana (se pueden parametrizar en BD en producción).
const BANCO_PREGUNTAS = [
  [
    { id: 'q1_1', texto: '¿Cómo calificarías la calidad del aire en tu ruta habitual hoy?', opciones: ['Muy mala','Mala','Regular','Buena','Excelente'] },
    { id: 'q1_2', texto: '¿Usaste transporte público esta semana?', opciones: ['Nunca','1-2 veces','3-4 veces','5 o más veces'] },
    { id: 'q1_3', texto: '¿Observaste congestión vehicular inusual?', opciones: ['Sí, mucha','Sí, moderada','Poca','No'] },
    { id: 'q1_4', texto: '¿Recomendarías CIUDATA a un vecino?', opciones: ['Definitivamente sí','Probablemente sí','No sé','No'] },
  ],
  [
    { id: 'q2_1', texto: '¿Sentiste algún síntoma relacionado con la contaminación esta semana?', opciones: ['Ninguno','Irritación ocular','Tos','Dificultad para respirar'] },
    { id: 'q2_2', texto: '¿Cuántas rutas alternativas tomaste para evitar zonas contaminadas?', opciones: ['Ninguna','1-2','3-4','Más de 4'] },
    { id: 'q2_3', texto: '¿Cómo valoras la funcionalidad del mapa en la app?', opciones: ['Deficiente','Regular','Buena','Excelente'] },
    { id: 'q2_4', texto: '¿Preferirías recibir alertas de calidad del aire en tiempo real?', opciones: ['Sí','No','Ya las recibo','No lo sé'] },
  ],
  [
    { id: 'q3_1', texto: '¿Cuál es el principal motivo por el que usas CIUDATA?', opciones: ['Rutas limpias','Gamificación','Reportar zonas','Información ambiental'] },
    { id: 'q3_2', texto: '¿Con qué frecuencia revisas tu ranking en la app?', opciones: ['Diario','2-3 veces/semana','Semanal','Nunca'] },
    { id: 'q3_3', texto: '¿La ciudad ha mejorado desde que usas la app?', opciones: ['Mucho','Algo','Igual','No lo sé'] },
    { id: 'q3_4', texto: '¿Participarías en una brigada de monitoreo ciudadano presencial?', opciones: ['Sí, con gusto','Tal vez','Probablemente no','No'] },
  ],
  [
    { id: 'q4_1', texto: '¿Qué tan satisfecho estás con los beneficios del programa este mes?', opciones: ['Muy insatisfecho','Insatisfecho','Satisfecho','Muy satisfecho'] },
    { id: 'q4_2', texto: '¿Notaste diferencia en la calidad del aire esta semana vs. la anterior?', opciones: ['Mejoró','Empeoró','Igual','No presté atención'] },
    { id: 'q4_3', texto: '¿Cuántos reportes de zona enviaste este mes?', opciones: ['Ninguno','1-2','3-5','Más de 5'] },
    { id: 'q4_4', texto: '¿Qué premio te motivaría más a participar el próximo mes?', opciones: ['Pizza gratis','Descuento en tienda','Canje en transporte','Reconocimiento público'] },
  ],
];

async function habilitarEncuesta() {
  console.log('[encuestas-habilitar] Habilitando encuesta semanal…');

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const cicloRow = await client.query(
      "SELECT id, created_at FROM ciclos WHERE estado = 'active' ORDER BY created_at DESC LIMIT 1"
    );
    if (!cicloRow.rowCount) {
      console.log('[encuestas-habilitar] No hay ciclo activo — skip.');
      await client.query('ROLLBACK');
      return;
    }

    const cicloId = cicloRow.rows[0].id;
    const inicioCiclo = new Date(cicloRow.rows[0].created_at);
    const ahora = new Date();
    // Semana dentro del ciclo (1-based)
    const semana = Math.min(
      Math.ceil((ahora - inicioCiclo) / (7 * 24 * 60 * 60 * 1000)),
      4
    ) || 1;

    // Desactiva la encuesta anterior del mismo ciclo.
    await client.query(
      "UPDATE encuestas SET activa = FALSE WHERE ciclo_id = $1 AND activa = TRUE",
      [cicloId]
    );

    const inicio = ahora;
    const fin = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000);
    const preguntas = BANCO_PREGUNTAS[(semana - 1) % BANCO_PREGUNTAS.length];

    await client.query(
      `INSERT INTO encuestas (ciclo_id, semana, preguntas, activa, inicio, fin)
       VALUES ($1, $2, $3, TRUE, $4, $5)
       ON CONFLICT (ciclo_id, semana)
       DO UPDATE SET activa = TRUE, inicio = $4, fin = $5`,
      [cicloId, semana, JSON.stringify(preguntas), inicio, fin]
    );

    await client.query('COMMIT');
    console.log(`[encuestas-habilitar] Semana ${semana} activada para ciclo ${cicloId}.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[encuestas-habilitar] Error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  habilitarEncuesta().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = habilitarEncuesta;
