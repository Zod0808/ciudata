// Middleware JWT: verifica Bearer token y revocación en tabla sesiones.
// Adjunta req.user = { id, phone_hash, jti } al request.
const jwt = require('jsonwebtoken');
const db  = require('../db');

const SECRET = process.env.JWT_SECRET;

async function authJwt(req, res, next) {
  if (!SECRET) {
    console.error('[authJwt] JWT_SECRET no configurado.');
    return res.status(500).json({ error: 'Configuración de autenticación incompleta.' });
  }

  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token de autenticación requerido.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, SECRET);
  } catch (err) {
    const msg = err.name === 'TokenExpiredError'
      ? 'Token expirado. Vuelve a iniciar sesión.'
      : 'Token inválido.';
    return res.status(401).json({ error: msg });
  }

  // Verifica que la sesión no haya sido revocada (logout).
  try {
    const { rowCount } = await db.query(
      'SELECT 1 FROM sesiones WHERE jti = $1 AND revocado = FALSE AND expires_at > NOW()',
      [decoded.jti]
    );
    if (!rowCount) {
      return res.status(401).json({ error: 'Sesión revocada. Vuelve a iniciar sesión.' });
    }
  } catch (err) {
    console.error('[authJwt] Error verificando sesión:', err.message);
    return res.status(500).json({ error: 'Error verificando autenticación.' });
  }

  req.user = decoded;
  next();
}

module.exports = authJwt;
