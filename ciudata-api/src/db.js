const { Pool } = require('pg');
require('dotenv').config();

// Supabase (y la mayoría de hosts cloud) requieren SSL.
// Se activa automáticamente cuando la URL contiene 'supabase' o DB_SSL=true.
const sslRequired =
  process.env.DB_SSL === 'true' ||
  (process.env.DATABASE_URL || '').includes('supabase');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslRequired ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 8000,
  // Render Free no tiene IPv6 — forzar resolución IPv4
  family: 4,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

module.exports = pool;
