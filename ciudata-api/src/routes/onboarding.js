// Flujo de onboarding automatizado para patrocinadores.
//
// POST /onboarding/sponsor       — registro self-service; genera API key automáticamente
// GET  /onboarding/sponsor/:id   — estado del onboarding (admin)
// POST /onboarding/sponsor/:id/activar — activa el sponsor (admin)
// POST /onboarding/sponsor/:id/asignar-ciclo — vincula sponsor a un ciclo
const { Router } = require('express');
const crypto = require('crypto');
const db     = require('../db');

const router = Router();

// ── Middleware admin ──────────────────────────────────────────────────────
function adminAuth(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Acceso de administrador requerido.' });
  }
  next();
}

// ── POST /onboarding/sponsor ─────────────────────────────────────────────
// Registro self-service. El sponsor queda en estado inactivo hasta que admin lo active.
router.post('/sponsor', async (req, res) => {
  const { nombre, email, telefono, empresa, descripcion_piloto } = req.body;

  if (!nombre || !email || !empresa) {
    return res.status(400).json({ error: 'nombre, email y empresa son requeridos.' });
  }

  // Validación básica de email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Email inválido.' });
  }

  // Genera API key criptográficamente segura (64 chars hex = 32 bytes CSPRNG)
  const api_key = crypto.randomBytes(32).toString('hex');

  try {
    // activo = FALSE: el sponsor queda pendiente de revisión y activación por admin.
    const { rows } = await db.query(
      `INSERT INTO sponsors (nombre, api_key, activo)
       VALUES ($1, $2, FALSE)
       RETURNING id, nombre, created_at`,
      [nombre, api_key]
    );

    const sponsor = rows[0];

    // Almacena metadatos de onboarding en la tabla (via JSONB o columnas extra).
    // Por simplicidad del piloto, logueamos y enviamos al admin por email en producción.
    console.log(`[onboarding] Nuevo sponsor registrado: ${nombre} (${email})`);
    console.log(`  empresa: ${empresa}`);
    console.log(`  piloto:  ${descripcion_piloto || 'N/A'}`);
    console.log(`  api_key: ${api_key}  ← Enviar al sponsor tras activación`);

    // TODO producción: enviar email de bienvenida al sponsor
    // y notificar al admin para revisión y activación.
    // await mailer.bienvenidaSponsor({ nombre, email, api_key });
    // await mailer.notificarAdmin({ sponsor, email, empresa });

    return res.status(201).json({
      mensaje: 'Registro recibido. Tu cuenta será revisada y activada en 24 h hábiles.',
      sponsor_id: sponsor.id,
      // La api_key se entrega en el email de activación, no en esta respuesta.
      // Para el entorno de desarrollo la exponemos directamente:
      ...(process.env.NODE_ENV !== 'production' && { api_key }),
    });
  } catch (err) {
    console.error('[onboarding/sponsor]', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// ── GET /onboarding/sponsor/:id ──────────────────────────────────────────
router.get('/sponsor/:id', adminAuth, async (req, res) => {
  try {
    const { rows, rowCount } = await db.query(
      `SELECT s.id, s.nombre, s.activo, s.created_at,
              c.id AS ciclo_id, c.mes, c.anio, c.estado AS ciclo_estado
       FROM sponsors s
       LEFT JOIN ciclos c ON c.sponsor_id_fk = s.id
       WHERE s.id = $1
       ORDER BY c.anio DESC, c.mes DESC`,
      [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Sponsor no encontrado.' });

    return res.json({ sponsor: rows[0], ciclos: rows.filter(r => r.ciclo_id) });
  } catch (err) {
    console.error('[onboarding/estado]', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// ── POST /onboarding/sponsor/:id/activar ─────────────────────────────────
// Admin activa el sponsor y entrega la api_key (en prod se enviaría por email).
router.post('/sponsor/:id/activar', adminAuth, async (req, res) => {
  try {
    const { rows, rowCount } = await db.query(
      `UPDATE sponsors SET activo = TRUE WHERE id = $1 AND activo = FALSE
       RETURNING id, nombre, api_key`,
      [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Sponsor no encontrado o ya activo.' });

    const s = rows[0];
    console.log(`[onboarding] Sponsor activado: ${s.nombre} — api_key: ${s.api_key}`);

    return res.json({
      mensaje:  `Sponsor "${s.nombre}" activado.`,
      sponsor_id: s.id,
      api_key: s.api_key, // En producción se envía por email, no por API response.
    });
  } catch (err) {
    console.error('[onboarding/activar]', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// ── POST /onboarding/sponsor/:id/asignar-ciclo ───────────────────────────
// Vincula un sponsor activo al ciclo del mes indicado.
router.post('/sponsor/:id/asignar-ciclo', adminAuth, async (req, res) => {
  const { mes, anio } = req.body;
  if (!mes || !anio) return res.status(400).json({ error: 'mes y anio son requeridos.' });

  try {
    const cicloRow = await db.query(
      'SELECT id FROM ciclos WHERE mes = $1 AND anio = $2',
      [mes, anio]
    );
    if (!cicloRow.rowCount) return res.status(404).json({ error: 'Ciclo no encontrado.' });

    const cicloId = cicloRow.rows[0].id;

    const sponsorRow = await db.query(
      'SELECT nombre FROM sponsors WHERE id = $1 AND activo = TRUE',
      [req.params.id]
    );
    if (!sponsorRow.rowCount) return res.status(404).json({ error: 'Sponsor no encontrado o inactivo.' });

    await db.query(
      'UPDATE ciclos SET sponsor_id_fk = $1, sponsor_nombre = $2 WHERE id = $3',
      [req.params.id, sponsorRow.rows[0].nombre, cicloId]
    );

    return res.json({
      mensaje: `Sponsor "${sponsorRow.rows[0].nombre}" asignado al ciclo ${mes}/${anio}.`,
      ciclo_id: cicloId,
    });
  } catch (err) {
    console.error('[onboarding/asignar-ciclo]', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

module.exports = router;
