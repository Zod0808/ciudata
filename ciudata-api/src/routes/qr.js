// GET  /qr/:token         — verifica validez del cupón QR (flujo sponsor)
// POST /qr/:token/canjear — registra el canje; idempotente, 409 en reintento de fraude
const { Router } = require('express');
const db = require('../db');

const router = Router();

// ── GET /qr/:token ─────────────────────────────────────────────────────────
router.get('/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const { rows, rowCount } = await db.query(
      `SELECT id, tipo_descuento, canjeado, canjeado_at, expires_at, usuario_id, ciclo_id
       FROM codigos_qr
       WHERE token = $1`,
      [token]
    );

    if (!rowCount) return res.status(404).json({ error: 'QR no encontrado.' });

    const qr = rows[0];
    const ahora = new Date();

    if (qr.expires_at && new Date(qr.expires_at) < ahora) {
      return res.status(410).json({ error: 'QR expirado.', valido: false });
    }

    return res.json({
      valido: !qr.canjeado,
      canjeado: qr.canjeado,
      canjeado_at: qr.canjeado_at,
      tipo_descuento: qr.tipo_descuento,
      usuario_id: qr.usuario_id,
      ciclo_id: qr.ciclo_id,
    });
  } catch (err) {
    console.error('[qr/verificar]', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// ── POST /qr/:token/canjear ─────────────────────────────────────────────────
// Idempotente por diseño: si ya fue canjeado devuelve 409 (anti-fraude).
router.post('/:token/canjear', async (req, res) => {
  const { token } = req.params;
  const { sponsor_id } = req.body;

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // SELECT FOR UPDATE evita race conditions en canjes concurrentes.
    const { rows, rowCount } = await client.query(
      `SELECT id, canjeado, expires_at, tipo_descuento, usuario_id
       FROM codigos_qr
       WHERE token = $1
       FOR UPDATE`,
      [token]
    );

    if (!rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'QR no encontrado.' });
    }

    const qr = rows[0];

    if (qr.expires_at && new Date(qr.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(410).json({ error: 'QR expirado.' });
    }

    // Canje duplicado — respuesta 409 como indica el spec anti-fraude.
    if (qr.canjeado) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'QR ya canjeado.',
        canjeado_at: qr.canjeado_at,
      });
    }

    await client.query(
      `UPDATE codigos_qr SET canjeado = TRUE, canjeado_at = NOW() WHERE id = $1`,
      [qr.id]
    );

    await client.query('COMMIT');

    return res.json({
      mensaje: 'Canje registrado correctamente.',
      tipo_descuento: qr.tipo_descuento,
      usuario_id: qr.usuario_id,
      canjeado_at: new Date(),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[qr/canjear]', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  } finally {
    client.release();
  }
});

module.exports = router;
