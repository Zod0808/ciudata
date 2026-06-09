// [Día 5 mes sig. - 09:00] Genera y almacena el reporte de métricas del ciclo para el sponsor.
// Cron: "0 9 5 * *"
// En producción: enviar el JSON por email (nodemailer) o webhook al sponsor.
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const db = require('../db');

async function generarReporteSponsor() {
  console.log('[reporte-sponsor] Generando reporte mensual…');

  // Toma el ciclo más reciente en estado rewarded.
  const cicloRow = await db.query(
    `SELECT c.id, c.mes, c.anio, c.sponsor_nombre, s.nombre AS sponsor_real
     FROM ciclos c
     LEFT JOIN sponsors s ON s.id = c.sponsor_id_fk
     WHERE c.estado = 'rewarded'
     ORDER BY c.anio DESC, c.mes DESC
     LIMIT 1`
  );

  if (!cicloRow.rowCount) {
    console.log('[reporte-sponsor] No hay ciclo premiado — skip.');
    return;
  }

  const ciclo = cicloRow.rows[0];

  // ── Métricas de participación ──────────────────────────────────────────
  const [usuarios, eventos, porTipo, top10, qrsCanjeados] = await Promise.all([
    db.query(
      'SELECT COUNT(DISTINCT usuario_id) AS total FROM puntos_eventos WHERE ciclo_id = $1',
      [ciclo.id]
    ),
    db.query(
      'SELECT COUNT(*) AS total, SUM(puntos) AS puntos_totales FROM puntos_eventos WHERE ciclo_id = $1',
      [ciclo.id]
    ),
    db.query(
      `SELECT tipo, COUNT(*) AS cantidad, SUM(puntos) AS puntos
       FROM puntos_eventos WHERE ciclo_id = $1 GROUP BY tipo ORDER BY cantidad DESC`,
      [ciclo.id]
    ),
    db.query(
      `SELECT rm.posicion, rm.total_puntos, qr.tipo_descuento, qr.canjeado
       FROM ranking_mensual rm
       LEFT JOIN codigos_qr qr ON qr.usuario_id = rm.usuario_id AND qr.ciclo_id = $1
       WHERE rm.ciclo_id = $1 AND rm.posicion <= 10
       ORDER BY rm.posicion ASC`,
      [ciclo.id]
    ),
    db.query(
      'SELECT COUNT(*) AS total FROM codigos_qr WHERE ciclo_id = $1 AND canjeado = TRUE',
      [ciclo.id]
    ),
  ]);

  const reporte = {
    generado_at: new Date().toISOString(),
    ciclo: { id: ciclo.id, mes: ciclo.mes, anio: ciclo.anio },
    sponsor: ciclo.sponsor_real || ciclo.sponsor_nombre || 'N/A',
    participacion: {
      usuarios_unicos:  parseInt(usuarios.rows[0].total, 10),
      total_eventos:    parseInt(eventos.rows[0].total, 10),
      puntos_totales:   parseInt(eventos.rows[0].puntos_totales || 0, 10),
    },
    por_tipo_evento: porTipo.rows,
    top10_ganadores: top10.rows,
    qrs: {
      emitidos:  top10.rows.length,
      canjeados: parseInt(qrsCanjeados.rows[0].total, 10),
    },
    impacto_estimado: {
      reportes_zona:  porTipo.rows.find(r => r.tipo === 'reporte')?.cantidad || 0,
      rutas_confirmadas: porTipo.rows.find(r => r.tipo === 'ruta')?.cantidad || 0,
      encuestas_completadas: porTipo.rows.find(r => r.tipo === 'encuesta')?.cantidad || 0,
    },
  };

  console.log('[reporte-sponsor] Reporte generado:');
  console.log(JSON.stringify(reporte, null, 2));

  // TODO producción: enviar por email/webhook usando el campo email del sponsor.
  // await mailer.enviarReporte(ciclo.sponsor_email, reporte);

  return reporte;
}

if (require.main === module) {
  generarReporteSponsor().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = generarReporteSponsor;
