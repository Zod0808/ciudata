// Valida que el header X-Api-Key o ?key= corresponda a un sponsor activo.
const db = require('../db');

async function sponsorAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.key;

  if (!apiKey) {
    return res.status(401).json({ error: 'API key requerida.' });
  }

  try {
    const { rows, rowCount } = await db.query(
      "SELECT id, nombre FROM sponsors WHERE api_key = $1 AND activo = TRUE",
      [apiKey]
    );
    if (!rowCount) return res.status(403).json({ error: 'API key inválida o desactivada.' });

    req.sponsor = rows[0];
    next();
  } catch (err) {
    console.error('[sponsorAuth]', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
}

module.exports = sponsorAuth;
