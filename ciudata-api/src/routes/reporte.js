// POST /reporte/zona
// +10 pts si un domo cercano (≤ 1 km) registra una anomalía en ±30 min.
// Si no hay datos de domo disponibles, se almacena el reporte como "pendiente_validacion"
// y se otorgan puntos (degradación elegante para el piloto sin IoT completo).
const { Router } = require('express');
const db    = require('../db');
const cache = require('../cache');
const {
  PUNTOS_REPORTE,
  aplicarTecho,
  validarDomo,
} = require('../helpers/puntos');

const router = Router();

const TIPOS_VALIDOS = ['pm25', 'trafico', 'accidente', 'obra', 'otro'];

router.post('/zona', async (req, res) => {
  const { usuario_id, ciclo_id, lat, lng, tipo_reporte, datos } = req.body;

  if (!usuario_id || !ciclo_id || lat == null || lng == null || !tipo_reporte) {
    return res.status(400).json({ error: 'usuario_id, ciclo_id, lat, lng y tipo_reporte son requeridos.' });
  }
  if (!TIPOS_VALIDOS.includes(tipo_reporte)) {
    return res.status(400).json({ error: `tipo_reporte debe ser uno de: ${TIPOS_VALIDOS.join(', ')}.` });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const cicloRow = await client.query(
      "SELECT id FROM ciclos WHERE id = $1 AND estado = 'active'",
      [ciclo_id]
    );
    if (!cicloRow.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Ciclo no activo.' });
    }

    // ── Validación por domo cercano ───────────────────────────────────────
    const validacion = await validarDomo(client, lat, lng);

    // Solo se rechazan reportes cuando hay un domo en rango pero sin anomalía.
    // Si no hay domos en BD (piloto sin IoT), se acepta con flag "pendiente".
    if (!validacion.validado && validacion.razon !== 'sin_domos') {
      await client.query('ROLLBACK');
      return res.status(422).json({
        error: 'Reporte no validado: no se detectó anomalía en domo cercano en el período esperado.',
        domo_id:      validacion.domo_id,
        distancia_km: validacion.distancia_km,
        razon:        validacion.razon,
      });
    }

    // ── Techo mensual ─────────────────────────────────────────────────────
    const puntosReales = await aplicarTecho(client, usuario_id, ciclo_id, PUNTOS_REPORTE);

    const { rows } = await client.query(
      `INSERT INTO puntos_eventos (usuario_id, ciclo_id, tipo, puntos, metadata)
       VALUES ($1, $2, 'reporte', $3, $4)
       RETURNING id, puntos, created_at`,
      [
        usuario_id, ciclo_id, puntosReales,
        JSON.stringify({
          lat, lng, tipo_reporte, datos: datos || {},
          validacion_domo: validacion,
        }),
      ]
    );

    await client.query('COMMIT');
    await cache.invalidateRanking(ciclo_id);

    return res.status(201).json({
      evento_id:        rows[0].id,
      puntos_otorgados: rows[0].puntos,
      created_at:       rows[0].created_at,
      validacion_domo:  validacion,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[reporte/zona]', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  } finally {
    client.release();
  }
});

module.exports = router;
