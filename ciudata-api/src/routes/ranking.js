// GET /ranking/ciclo/:cycle_id?page=1
// Devuelve el ranking paginado (25 registros por página).
// Primero intenta la tabla materializada ranking_mensual (ciclo cerrado),
// luego cae a la caché Redis del ranking provisional (ciclo activo).
const { Router } = require('express');
const db = require('../db');
const cache = require('../cache');

const router = Router();
const PAGE_SIZE = 25;

router.get('/ciclo/:cycle_id', async (req, res) => {
  const { cycle_id } = req.params;
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const offset = (page - 1) * PAGE_SIZE;

  try {
    // ── Ciclo cerrado: usa la tabla materializada ────────────────────────────
    const cicloRow = await db.query('SELECT estado FROM ciclos WHERE id = $1', [cycle_id]);
    if (!cicloRow.rowCount) return res.status(404).json({ error: 'Ciclo no encontrado.' });

    if (cicloRow.rows[0].estado !== 'active') {
      const { rows } = await db.query(
        `SELECT posicion, usuario_id, total_puntos
         FROM ranking_mensual
         WHERE ciclo_id = $1
         ORDER BY posicion ASC
         LIMIT $2 OFFSET $3`,
        [cycle_id, PAGE_SIZE, offset]
      );
      return res.json({ ciclo_id: cycle_id, page, data: rows, fuente: 'materializado' });
    }

    // ── Ciclo activo: intenta caché Redis ────────────────────────────────────
    const cached = await cache.getRanking(cycle_id);
    if (cached) {
      const slice = cached.slice(offset, offset + PAGE_SIZE);
      return res.json({ ciclo_id: cycle_id, page, data: slice, fuente: 'cache' });
    }

    // ── Fallback: query directa (solo si la caché no está disponible) ────────
    const { rows } = await db.query(
      `SELECT
         RANK() OVER (ORDER BY SUM(puntos) DESC) AS posicion,
         usuario_id,
         SUM(puntos) AS total_puntos
       FROM puntos_eventos
       WHERE ciclo_id = $1 AND puntos > 0
       GROUP BY usuario_id
       ORDER BY total_puntos DESC
       LIMIT $2 OFFSET $3`,
      [cycle_id, PAGE_SIZE, offset]
    );

    return res.json({ ciclo_id: cycle_id, page, data: rows, fuente: 'db_directa' });
  } catch (err) {
    console.error('[ranking/ciclo]', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

module.exports = router;
