// Integración IoT con la red de "domos" de monitoreo ambiental.
//
// POST /domos/lectura          — webhook que los domos llaman al registrar una lectura
//                               Autenticado con DOMO_WEBHOOK_SECRET en header X-Domo-Secret.
// GET  /domos                  — lista de domos activos (público)
// POST /domos                  — registra un nuevo domo (requiere X-Admin-Key)
// GET  /domos/:id/lecturas     — últimas N lecturas de un domo
// POST /domos/simular          — inyecta una lectura simulada (solo en dev)
const { Router } = require('express');
const db = require('../db');

const router = Router();

// Umbrales ECA-Aire Perú (MINAM) para PM2.5 (μg/m³)
const UMBRAL_PM25_ANOMALIA = 25; // ECA 24h = 25 μg/m³

// ── Middleware: valida el secret de webhook del domo ─────────────────────
function domoAuth(req, res, next) {
  const secret = req.headers['x-domo-secret'];
  if (!process.env.DOMO_WEBHOOK_SECRET || secret !== process.env.DOMO_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Autenticación de domo requerida.' });
  }
  next();
}

// ── Middleware: administrador ─────────────────────────────────────────────
function adminAuth(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Acceso de administrador requerido.' });
  }
  next();
}

// ── POST /domos/lectura ──────────────────────────────────────────────────
// Payload: { domo_id, pm25, timestamp? }
// El domo registra su lectura; el sistema determina si es anomalía automáticamente.
router.post('/lectura', domoAuth, async (req, res) => {
  const { domo_id, pm25, timestamp } = req.body;

  if (!domo_id || pm25 == null) {
    return res.status(400).json({ error: 'domo_id y pm25 son requeridos.' });
  }
  if (typeof pm25 !== 'number' || pm25 < 0 || pm25 > 1000) {
    return res.status(400).json({ error: 'pm25 debe ser un número entre 0 y 1000.' });
  }

  try {
    const domoRow = await db.query(
      'SELECT id FROM domos WHERE id = $1 AND activo = TRUE',
      [domo_id]
    );
    if (!domoRow.rowCount) {
      return res.status(404).json({ error: 'Domo no encontrado o inactivo.' });
    }

    const anomalia  = pm25 > UMBRAL_PM25_ANOMALIA;
    const leida_at  = timestamp ? new Date(timestamp) : new Date();

    const { rows } = await db.query(
      `INSERT INTO lecturas_domos (domo_id, pm25, anomalia, leida_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id, anomalia, leida_at`,
      [domo_id, pm25, anomalia, leida_at]
    );

    return res.status(201).json({
      lectura_id: rows[0].id,
      anomalia:   rows[0].anomalia,
      pm25,
      umbral_eca: UMBRAL_PM25_ANOMALIA,
      leida_at:   rows[0].leida_at,
    });
  } catch (err) {
    console.error('[domos/lectura]', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// ── GET /domos ────────────────────────────────────────────────────────────
router.get('/', async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT d.id, d.nombre, d.lat, d.lng,
              l.pm25 AS ultimo_pm25, l.anomalia AS ultima_anomalia, l.leida_at AS ultima_lectura
       FROM domos d
       LEFT JOIN LATERAL (
         SELECT pm25, anomalia, leida_at FROM lecturas_domos
         WHERE domo_id = d.id ORDER BY leida_at DESC LIMIT 1
       ) l ON TRUE
       WHERE d.activo = TRUE
       ORDER BY d.nombre ASC`
    );
    return res.json({ domos: rows });
  } catch (err) {
    console.error('[domos/listar]', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// ── POST /domos ───────────────────────────────────────────────────────────
router.post('/', adminAuth, async (req, res) => {
  const { nombre, lat, lng } = req.body;
  if (!nombre || lat == null || lng == null) {
    return res.status(400).json({ error: 'nombre, lat y lng son requeridos.' });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO domos (nombre, lat, lng) VALUES ($1, $2, $3)
       RETURNING id, nombre, lat, lng, created_at`,
      [nombre, lat, lng]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[domos/crear]', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// ── GET /domos/:id/lecturas ───────────────────────────────────────────────
router.get('/:id/lecturas', async (req, res) => {
  const limite = Math.min(parseInt(req.query.limit || '50', 10), 200);
  try {
    const { rows } = await db.query(
      `SELECT id, pm25, anomalia, leida_at FROM lecturas_domos
       WHERE domo_id = $1 ORDER BY leida_at DESC LIMIT $2`,
      [req.params.id, limite]
    );
    return res.json({ domo_id: req.params.id, lecturas: rows });
  } catch (err) {
    console.error('[domos/lecturas]', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// ── POST /domos/simular (solo NODE_ENV !== 'production') ─────────────────
// Permite inyectar lecturas simuladas para probar la validación de reportes.
router.post('/simular', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'No disponible en producción.' });
  }

  const { domo_id, pm25, backdating_min = 0 } = req.body;
  if (!domo_id || pm25 == null) {
    return res.status(400).json({ error: 'domo_id y pm25 son requeridos.' });
  }

  const leida_at = new Date(Date.now() - backdating_min * 60 * 1000);
  const anomalia = pm25 > UMBRAL_PM25_ANOMALIA;

  try {
    const { rows } = await db.query(
      `INSERT INTO lecturas_domos (domo_id, pm25, anomalia, leida_at)
       VALUES ($1, $2, $3, $4) RETURNING id, anomalia, leida_at`,
      [domo_id, pm25, anomalia, leida_at]
    );
    return res.status(201).json({ simulado: true, ...rows[0], pm25 });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno.' });
  }
});

module.exports = router;
