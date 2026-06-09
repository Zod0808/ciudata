// POST /auth/solicitar-otp  — genera OTP y lo envía por SMS al teléfono del usuario
// POST /auth/verificar-otp  — verifica el código y devuelve JWT
// POST /auth/fcm-token      — registra el FCM push token (requiere JWT)
// POST /auth/logout         — revoca el JWT activo
const { Router } = require('express');
const crypto     = require('crypto');
const jwt        = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db         = require('../db');
const authJwt    = require('../middleware/authJwt');
const {
  generarCodigoOTP,
  hashOTP,
  verificarHashOTP,
  enviarSMS,
  OTP_TTL_MIN,
  MAX_INTENTOS,
} = require('../services/otp');

const router = Router();

const JWT_TTL = process.env.JWT_TTL || '7d';

// ── Hashea el número de teléfono (igual lógica que phone_hash en usuarios) ─
function hashPhone(phone) {
  return crypto.createHash('sha256').update(phone.trim()).digest('hex');
}

// ── POST /auth/solicitar-otp ─────────────────────────────────────────────
router.post('/solicitar-otp', async (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^\+?\d{7,15}$/.test(phone.trim())) {
    return res.status(400).json({ error: 'Número de teléfono inválido.' });
  }

  const phoneHash = hashPhone(phone);
  const codigo    = generarCodigoOTP();
  const otpHash   = await hashOTP(codigo);

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Invalida OTPs anteriores activos para este número.
    await client.query(
      'UPDATE otp_tokens SET used = TRUE WHERE phone_hash = $1 AND used = FALSE',
      [phoneHash]
    );

    await client.query(
      `INSERT INTO otp_tokens (phone_hash, otp_hash, expires_at)
       VALUES ($1, $2, NOW() + (INTERVAL '1 minute' * $3))`,
      [phoneHash, otpHash, OTP_TTL_MIN]
    );

    await client.query('COMMIT');

    const canal = await enviarSMS(phone, codigo);
    return res.json({ mensaje: 'Código enviado.', canal: canal.canal, ttl_min: OTP_TTL_MIN });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[auth/solicitar-otp]', err.message);
    return res.status(500).json({ error: 'Error al enviar OTP.' });
  } finally {
    client.release();
  }
});

// ── POST /auth/verificar-otp ─────────────────────────────────────────────
router.post('/verificar-otp', async (req, res) => {
  const { phone, codigo } = req.body;
  if (!phone || !codigo) {
    return res.status(400).json({ error: 'phone y codigo son requeridos.' });
  }

  const phoneHash = hashPhone(phone);

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const otpRow = await client.query(
      `SELECT id, otp_hash, intentos, expires_at
       FROM otp_tokens
       WHERE phone_hash = $1 AND used = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [phoneHash]
    );

    if (!otpRow.rowCount) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'OTP no encontrado o expirado.' });
    }

    const otp = otpRow.rows[0];

    if (otp.intentos >= MAX_INTENTOS) {
      await client.query('UPDATE otp_tokens SET used = TRUE WHERE id = $1', [otp.id]);
      await client.query('COMMIT');
      return res.status(429).json({ error: 'Demasiados intentos fallidos. Solicita un nuevo código.' });
    }

    const valido = await verificarHashOTP(codigo, otp.otp_hash);

    if (!valido) {
      await client.query(
        'UPDATE otp_tokens SET intentos = intentos + 1 WHERE id = $1',
        [otp.id]
      );
      await client.query('COMMIT');
      return res.status(401).json({
        error: 'Código incorrecto.',
        intentos_restantes: MAX_INTENTOS - (otp.intentos + 1),
      });
    }

    // Marca el OTP como usado.
    await client.query('UPDATE otp_tokens SET used = TRUE WHERE id = $1', [otp.id]);

    // Crea o recupera el usuario (upsert por phone_hash).
    const userRow = await client.query(
      `INSERT INTO usuarios (phone_hash)
       VALUES ($1)
       ON CONFLICT (phone_hash) DO UPDATE SET phone_hash = EXCLUDED.phone_hash
       RETURNING id, phone_hash, created_at`,
      [phoneHash]
    );

    const usuario = userRow.rows[0];
    const jti     = uuidv4();

    // Registra la sesión para permitir revocación.
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await client.query(
      `INSERT INTO sesiones (jti, usuario_id, expires_at) VALUES ($1, $2, $3)`,
      [jti, usuario.id, expiresAt]
    );

    await client.query('COMMIT');

    const token = jwt.sign(
      { id: usuario.id, phone_hash: usuario.phone_hash, jti },
      process.env.JWT_SECRET,
      { expiresIn: JWT_TTL }
    );

    return res.json({
      token,
      usuario: { id: usuario.id, created_at: usuario.created_at },
      expires_in: JWT_TTL,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[auth/verificar-otp]', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  } finally {
    client.release();
  }
});

// ── POST /auth/fcm-token (requiere JWT) ──────────────────────────────────
router.post('/fcm-token', authJwt, async (req, res) => {
  const { fcm_token } = req.body;
  if (!fcm_token) return res.status(400).json({ error: 'fcm_token es requerido.' });

  try {
    await db.query(
      'UPDATE usuarios SET fcm_token = $1 WHERE id = $2',
      [fcm_token, req.user.id]
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error('[auth/fcm-token]', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// ── POST /auth/logout (requiere JWT) ────────────────────────────────────
router.post('/logout', authJwt, async (req, res) => {
  try {
    await db.query(
      'UPDATE sesiones SET revocado = TRUE WHERE jti = $1',
      [req.user.jti]
    );
    return res.json({ ok: true, mensaje: 'Sesión cerrada.' });
  } catch (err) {
    console.error('[auth/logout]', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

module.exports = router;
