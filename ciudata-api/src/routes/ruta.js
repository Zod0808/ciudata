// POST /ruta/iniciar   — registra inicio de ruta sugerida, devuelve session_token
// POST /ruta/confirmar — valida sesión ≥ 60 s, máx 3 rutas/día, aplica techo
const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const db    = require('../db');
const cache = require('../cache');
const {
  PUNTOS_RUTA,
  MAX_RUTAS_DIA,
  MIN_DURACION_RUTA_SEG,
  MAX_DURACION_RUTA_SEG,
  aplicarTecho,
  rutasHoy,
} = require('../helpers/puntos');

const router = Router();

// ── POST /ruta/iniciar ────────────────────────────────────────────────────
router.post('/iniciar', async (req, res) => {
  const { usuario_id, ciclo_id, origen, destino } = req.body;

  if (!usuario_id || !ciclo_id || !origen || !destino) {
    return res.status(400).json({ error: 'usuario_id, ciclo_id, origen y destino son requeridos.' });
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

    // ── Control de fraude: máx 3 rutas confirmadas hoy ────────────────────
    const realizadas = await rutasHoy(client, usuario_id, ciclo_id);
    if (realizadas >= MAX_RUTAS_DIA) {
      await client.query('ROLLBACK');
      return res.status(429).json({
        error: `Límite diario alcanzado (${MAX_RUTAS_DIA} rutas/día).`,
        rutas_hoy: realizadas,
      });
    }

    const session_token = uuidv4();
    const expires_at    = new Date(Date.now() + MAX_DURACION_RUTA_SEG * 1000);

    await client.query(
      `INSERT INTO puntos_eventos (usuario_id, ciclo_id, tipo, puntos, metadata)
       VALUES ($1, $2, 'ruta', 0, $3)`,
      [
        usuario_id, ciclo_id,
        JSON.stringify({ estado: 'iniciada', session_token, origen, destino, expires_at }),
      ]
    );

    await client.query('COMMIT');
    return res.status(201).json({ session_token, expires_at, min_duracion_seg: MIN_DURACION_RUTA_SEG });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ruta/iniciar]', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  } finally {
    client.release();
  }
});

// ── POST /ruta/confirmar ──────────────────────────────────────────────────
router.post('/confirmar', async (req, res) => {
  const { usuario_id, ciclo_id, session_token, distancia_km } = req.body;

  if (!usuario_id || !ciclo_id || !session_token) {
    return res.status(400).json({ error: 'usuario_id, ciclo_id y session_token son requeridos.' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const sesionRow = await client.query(
      `SELECT id, created_at, metadata
       FROM puntos_eventos
       WHERE usuario_id            = $1
         AND ciclo_id              = $2
         AND tipo                  = 'ruta'
         AND puntos                = 0
         AND metadata->>'session_token' = $3
         AND metadata->>'estado'   = 'iniciada'
       LIMIT 1
       FOR UPDATE`,
      [usuario_id, ciclo_id, session_token]
    );

    if (!sesionRow.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Sesión de ruta no encontrada o ya confirmada.' });
    }

    const sesion = sesionRow.rows[0];
    const ahora  = new Date();

    if (new Date(sesion.metadata.expires_at) < ahora) {
      await client.query('ROLLBACK');
      return res.status(410).json({ error: 'Sesión de ruta expirada.' });
    }

    // ── Validación de duración mínima (≥ 60 s con GPS activo) ─────────────
    const duracionSeg = (ahora - new Date(sesion.created_at)) / 1000;
    if (duracionSeg < MIN_DURACION_RUTA_SEG) {
      await client.query('ROLLBACK');
      return res.status(422).json({
        error: `Sesión demasiado corta (${Math.round(duracionSeg)} s). Mínimo: ${MIN_DURACION_RUTA_SEG} s.`,
        duracion_seg: Math.round(duracionSeg),
      });
    }

    // ── Techo mensual ─────────────────────────────────────────────────────
    const puntosReales = await aplicarTecho(client, usuario_id, ciclo_id, PUNTOS_RUTA);

    await client.query(
      `UPDATE puntos_eventos
       SET puntos   = $1,
           metadata = metadata || $2::jsonb
       WHERE id = $3`,
      [
        puntosReales,
        JSON.stringify({ estado: 'confirmada', distancia_km, duracion_seg: Math.round(duracionSeg), confirmado_at: ahora }),
        sesion.id,
      ]
    );

    await client.query('COMMIT');
    await cache.invalidateRanking(ciclo_id);

    const realizadasHoy = await rutasHoy(db, usuario_id, ciclo_id);
    return res.json({
      puntos_otorgados: puntosReales,
      duracion_seg:     Math.round(duracionSeg),
      rutas_hoy:        realizadasHoy,
      limite_diario:    MAX_RUTAS_DIA,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ruta/confirmar]', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  } finally {
    client.release();
  }
});

module.exports = router;
