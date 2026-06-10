const { Pool } = require('pg');
require('dotenv').config();

const sslRequired =
  process.env.DB_SSL === 'true' ||
  (process.env.DATABASE_URL || '').includes('supabase');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslRequired ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 8000,
});

pool.on('error', (err) => console.error('[DB] Pool error:', err.message));

module.exports = {
  query:   (...args) => pool.query(...args),
  connect: (...args) => pool.connect(...args),
};
