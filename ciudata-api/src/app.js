// Forzar IPv4 antes de cualquier conexión — Render Free no soporta IPv6
require('dns').setDefaultResultOrder('ipv4first');

require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');

const encuestaRouter  = require('./routes/encuesta');
const encuestasRouter = require('./routes/encuestas');
const puntosRouter    = require('./routes/puntos');
const rankingRouter   = require('./routes/ranking');
const rutaRouter      = require('./routes/ruta');
const reporteRouter   = require('./routes/reporte');
const qrRouter        = require('./routes/qr');
const sponsorRouter    = require('./routes/sponsor');
const referidosRouter  = require('./routes/referidos');
const authRouter       = require('./routes/auth');
const domosRouter      = require('./routes/domos');
const onboardingRouter = require('./routes/onboarding');

const app = express();

app.use(express.json({ limit: '64kb' }));

// Limita a 60 peticiones/min por IP para todos los endpoints
app.use(rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false }));

// ── Rutas ────────────────────────────────────────────────────────────────────
app.use('/encuesta', encuestaRouter);
app.use('/encuesta', encuestasRouter);
app.use('/puntos',   puntosRouter);
app.use('/ranking',  rankingRouter);
app.use('/ruta',     rutaRouter);
app.use('/reporte',  reporteRouter);
app.use('/qr',       qrRouter);
app.use('/sponsor',    sponsorRouter);
app.use('/referidos',  referidosRouter);
app.use('/auth',       authRouter);
app.use('/domos',      domosRouter);
app.use('/onboarding', onboardingRouter);

// Health-check
app.get('/health', async (_req, res) => {
  const info = { ok: true, ts: new Date(), node: process.version };
  try {
    const db = require('./db');
    await db.query('SELECT 1');
    info.db = 'ok';
  } catch (e) {
    info.db = 'error';
    info.db_msg = e.message;
  }
  res.json(info);
});

// 404 genérico
app.use((_req, res) => res.status(404).json({ error: 'Endpoint no encontrado.' }));

const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, () => console.log(`[ciudata-api] Escuchando en puerto ${PORT}`));

module.exports = app;
