// Utilidades compartidas de puntuación: techo mensual y verificaciones de fraude.

const TECHO_MENSUAL   = 350;
const PUNTOS_POR_PREGUNTA = 10;
const PREGUNTAS_POR_SEMANA = 4;
const PUNTOS_RACHA    = 20;
const PUNTOS_RUTA     = 5;
const PUNTOS_REPORTE  = 10;
const PUNTOS_REFERIDO = 25;
const SEMANAS_CICLO   = 4;
const MAX_RUTAS_DIA   = 3;
const MIN_DURACION_RUTA_SEG = 60;
const MAX_DURACION_RUTA_SEG = 7200;
const RADIO_DOMO_KM   = 1.0;
const VENTANA_ANOMALIA_MIN = 30;

// Devuelve la suma de puntos del usuario en el ciclo (incluye racha, excluyendo eventos puntos=0).
async function puntosAcumulados(client, userId, cicloId) {
  const { rows } = await client.query(
    `SELECT COALESCE(SUM(puntos), 0) AS total
     FROM puntos_eventos
     WHERE usuario_id = $1 AND ciclo_id = $2 AND puntos > 0`,
    [userId, cicloId]
  );
  return parseInt(rows[0].total, 10);
}

// Aplica el techo mensual: devuelve los puntos reales a otorgar (puede ser 0 si ya llegó al techo).
async function aplicarTecho(client, userId, cicloId, puntosDeseados) {
  const acumulados  = await puntosAcumulados(client, userId, cicloId);
  const disponibles = Math.max(0, TECHO_MENSUAL - acumulados);
  return Math.min(puntosDeseados, disponibles);
}

// Conteo de rutas confirmadas hoy para el usuario.
async function rutasHoy(client, userId, cicloId) {
  const { rows } = await client.query(
    `SELECT COUNT(*) AS n
     FROM puntos_eventos
     WHERE usuario_id = $1
       AND ciclo_id   = $2
       AND tipo       = 'ruta'
       AND puntos     > 0
       AND created_at >= CURRENT_DATE
       AND created_at <  CURRENT_DATE + INTERVAL '1 day'`,
    [userId, cicloId]
  );
  return parseInt(rows[0].n, 10);
}

// Devuelve el número de semanas distintas en que el usuario ha completado encuestas en el ciclo.
async function semanasConEncuesta(client, userId, cicloId) {
  const { rows } = await client.query(
    `SELECT COUNT(DISTINCT metadata->>'semana') AS semanas
     FROM puntos_eventos
     WHERE usuario_id = $1 AND ciclo_id = $2 AND tipo = 'encuesta' AND puntos > 0`,
    [userId, cicloId]
  );
  return parseInt(rows[0].semanas, 10);
}

// Verifica si el usuario ya recibió el bonus de racha en este ciclo.
async function yaOtorgadaRacha(client, userId, cicloId) {
  const { rowCount } = await client.query(
    `SELECT 1 FROM puntos_eventos
     WHERE usuario_id = $1 AND ciclo_id = $2
       AND tipo = 'encuesta' AND metadata->>'es_racha' = 'true'
     LIMIT 1`,
    [userId, cicloId]
  );
  return rowCount > 0;
}

// Encuentra el domo más cercano (dentro de RADIO_DOMO_KM) y comprueba anomalía ±VENTANA_ANOMALIA_MIN.
// Retorna { validado: bool, domo_id, distancia_km } o null si no hay domos en BD.
async function validarDomo(client, lat, lng, ahora = new Date()) {
  const { rows } = await client.query(
    `SELECT
       id,
       nombre,
       (6371 * acos(
         LEAST(1.0,
           cos(radians($1)) * cos(radians(lat)) * cos(radians(lng) - radians($2))
           + sin(radians($1)) * sin(radians(lat))
         )
       )) AS distancia_km
     FROM domos
     WHERE activo = TRUE
     ORDER BY distancia_km ASC
     LIMIT 1`,
    [lat, lng]
  );

  if (!rows.length) return { validado: true, domo_id: null, distancia_km: null, razon: 'sin_domos' };

  const domo = rows[0];
  if (domo.distancia_km > RADIO_DOMO_KM) {
    return { validado: false, domo_id: domo.id, distancia_km: domo.distancia_km, razon: 'fuera_de_rango' };
  }

  const ventanaInicio = new Date(ahora.getTime() - VENTANA_ANOMALIA_MIN * 60 * 1000);
  const ventanaFin    = new Date(ahora.getTime() + VENTANA_ANOMALIA_MIN * 60 * 1000);

  const { rowCount } = await client.query(
    `SELECT 1 FROM lecturas_domos
     WHERE domo_id  = $1
       AND anomalia = TRUE
       AND leida_at BETWEEN $2 AND $3
     LIMIT 1`,
    [domo.id, ventanaInicio, ventanaFin]
  );

  return {
    validado:    rowCount > 0,
    domo_id:     domo.id,
    distancia_km: parseFloat(domo.distancia_km.toFixed(3)),
    razon:       rowCount > 0 ? 'anomalia_confirmada' : 'sin_anomalia',
  };
}

module.exports = {
  TECHO_MENSUAL,
  PUNTOS_POR_PREGUNTA,
  PREGUNTAS_POR_SEMANA,
  PUNTOS_RACHA,
  PUNTOS_RUTA,
  PUNTOS_REPORTE,
  PUNTOS_REFERIDO,
  SEMANAS_CICLO,
  MAX_RUTAS_DIA,
  MIN_DURACION_RUTA_SEG,
  MAX_DURACION_RUTA_SEG,
  puntosAcumulados,
  aplicarTecho,
  rutasHoy,
  semanasConEncuesta,
  yaOtorgadaRacha,
  validarDomo,
};
