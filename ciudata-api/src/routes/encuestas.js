// GET /encuesta/activa?ciclo_id=  — devuelve el bloque activo del ciclo
// POST /encuesta/responder        — ya está en encuesta.js; este archivo extiende el router
const { Router } = require('express');
const db = require('../db');

const router = Router();

router.get('/activa', async (req, res) => {
  const { ciclo_id } = req.query;

  try {
    let cicloId = ciclo_id;
    if (!cicloId) {
      const r = await db.query("SELECT id FROM ciclos WHERE estado = 'active' ORDER BY created_at DESC LIMIT 1");
      if (!r.rowCount) return res.status(404).json({ error: 'No hay ciclo activo.' });
      cicloId = r.rows[0].id;
    }

    const { rows, rowCount } = await db.query(
      `SELECT id, semana, preguntas, inicio, fin
       FROM encuestas
       WHERE ciclo_id = $1 AND activa = TRUE AND fin > NOW()
       LIMIT 1`,
      [cicloId]
    );

    if (!rowCount) return res.status(404).json({ error: 'No hay encuesta activa esta semana.' });

    return res.json({ ciclo_id: cicloId, ...rows[0] });
  } catch (err) {
    console.error('[encuesta/activa]', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

module.exports = router;
