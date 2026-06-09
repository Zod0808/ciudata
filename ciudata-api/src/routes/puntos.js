// GET /puntos/usuario/:user_id
// Devuelve el total de puntos y el historial de eventos del usuario en el ciclo activo.
const { Router } = require('express');
const db = require('../db');

const router = Router();

router.get('/usuario/:user_id', async (req, res) => {
  const { user_id } = req.params;
  const { ciclo_id } = req.query;

  try {
    // Si no se pasa ciclo_id, se usa el ciclo activo.
    let ciclo;
    if (ciclo_id) {
      ciclo = await db.query('SELECT id FROM ciclos WHERE id = $1', [ciclo_id]);
    } else {
      ciclo = await db.query("SELECT id FROM ciclos WHERE estado = 'active' ORDER BY created_at DESC LIMIT 1");
    }

    if (!ciclo.rowCount) {
      return res.status(404).json({ error: 'Ciclo no encontrado.' });
    }

    const resolvedCicloId = ciclo.rows[0].id;

    const { rows } = await db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN puntos > 0 THEN puntos ELSE 0 END), 0) AS total_puntos,
         JSON_AGG(
           JSON_BUILD_OBJECT('id', id, 'tipo', tipo, 'puntos', puntos, 'created_at', created_at)
           ORDER BY created_at DESC
         ) FILTER (WHERE puntos > 0) AS eventos
       FROM puntos_eventos
       WHERE usuario_id = $1 AND ciclo_id = $2`,
      [user_id, resolvedCicloId]
    );

    return res.json({
      usuario_id: user_id,
      ciclo_id: resolvedCicloId,
      total_puntos: parseInt(rows[0].total_puntos, 10),
      eventos: rows[0].eventos || [],
    });
  } catch (err) {
    console.error('[puntos/usuario]', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

module.exports = router;
