// GET /sponsor/metricas?ciclo_id=  — reporte de métricas del ciclo para el sponsor autenticado.
// Requiere header X-Api-Key o ?key=
const { Router } = require('express');
const db = require('../db');
const sponsorAuth = require('../middleware/sponsorAuth');

const router = Router();

router.use(sponsorAuth);

router.get('/metricas', async (req, res) => {
  const { ciclo_id } = req.query;

  try {
    let cicloId = ciclo_id;
    if (!cicloId) {
      const r = await db.query(
        "SELECT id FROM ciclos WHERE sponsor_id_fk = $1 ORDER BY created_at DESC LIMIT 1",
        [req.sponsor.id]
      );
      if (!r.rowCount) return res.status(404).json({ error: 'No hay ciclo para este sponsor.' });
      cicloId = r.rows[0].id;
    }

    const [part, porTipo, qrs] = await Promise.all([
      db.query(
        'SELECT COUNT(DISTINCT usuario_id) AS usuarios, SUM(puntos) AS puntos FROM puntos_eventos WHERE ciclo_id = $1',
        [cicloId]
      ),
      db.query(
        'SELECT tipo, COUNT(*) AS cantidad FROM puntos_eventos WHERE ciclo_id = $1 GROUP BY tipo',
        [cicloId]
      ),
      db.query(
        'SELECT COUNT(*) AS emitidos, SUM(CASE WHEN canjeado THEN 1 ELSE 0 END) AS canjeados FROM codigos_qr WHERE ciclo_id = $1',
        [cicloId]
      ),
    ]);

    return res.json({
      sponsor: req.sponsor.nombre,
      ciclo_id: cicloId,
      participacion: {
        usuarios_unicos: parseInt(part.rows[0].usuarios, 10),
        puntos_totales:  parseInt(part.rows[0].puntos || 0, 10),
      },
      por_tipo: porTipo.rows,
      qrs: {
        emitidos:  parseInt(qrs.rows[0].emitidos, 10),
        canjeados: parseInt(qrs.rows[0].canjeados, 10),
      },
    });
  } catch (err) {
    console.error('[sponsor/metricas]', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

module.exports = router;
