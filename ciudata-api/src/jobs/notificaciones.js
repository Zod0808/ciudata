// [Día 1 mes sig. - 09:00] Envía notificación push a ganadores del Top 10.
// Cron: "0 9 1 * *"
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const db    = require('../db');
const fcm   = require('../services/fcm');

const MENSAJES = {
  '100': { titulo: '🏆 ¡Eres el Campeón CIUDATA!', cuerpo: 'Ganaste una pizza GRATIS. Muestra tu código QR en el local para canjearlo.' },
  '50':  { titulo: '🥈 ¡Top 3 CIUDATA!',           cuerpo: 'Ganaste un 50 % de descuento. Tu código QR ya está listo en la app.' },
  '30':  { titulo: '🎉 ¡Top 10 CIUDATA!',           cuerpo: 'Ganaste un 30 % de descuento. Revisa tu código QR en la sección de premios.' },
};

async function notificarGanadores() {
  console.log('[notificaciones] Notificando ganadores…');

  // Obtiene el ciclo premiado más reciente.
  const cicloRow = await db.query(
    "SELECT id, mes, anio FROM ciclos WHERE estado = 'rewarded' ORDER BY anio DESC, mes DESC LIMIT 1"
  );
  if (!cicloRow.rowCount) {
    console.log('[notificaciones] No hay ciclo premiado — skip.');
    return;
  }

  const { id: cicloId, mes, anio } = cicloRow.rows[0];

  const { rows: ganadores } = await db.query(
    `SELECT rm.usuario_id, rm.posicion, qr.tipo_descuento, qr.token, u.fcm_token
     FROM ranking_mensual rm
     JOIN codigos_qr    qr ON qr.usuario_id = rm.usuario_id AND qr.ciclo_id = $1
     JOIN usuarios       u  ON u.id = rm.usuario_id
     WHERE rm.ciclo_id = $1 AND rm.posicion <= 10
     ORDER BY rm.posicion ASC`,
    [cicloId]
  );

  let enviados = 0;

  for (const g of ganadores) {
    const msg = MENSAJES[g.tipo_descuento];
    if (!msg) continue;

    const result = await fcm.enviar(g.fcm_token, msg.titulo, msg.cuerpo, {
      tipo: 'ganador',
      posicion: String(g.posicion),
      qr_token: g.token,
      ciclo_id: cicloId,
    });

    // Registra en log independientemente del resultado.
    await db.query(
      `INSERT INTO notificaciones_log (usuario_id, ciclo_id, tipo, payload)
       VALUES ($1, $2, 'ganador', $3)`,
      [g.usuario_id, cicloId, JSON.stringify({ posicion: g.posicion, tipo_descuento: g.tipo_descuento, result })]
    );

    if (!result.skipped && !result.error) enviados++;
  }

  console.log(`[notificaciones] ${enviados}/${ganadores.length} notificaciones enviadas para ciclo ${mes}/${anio}.`);
}

if (require.main === module) {
  notificarGanadores().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = notificarGanadores;
