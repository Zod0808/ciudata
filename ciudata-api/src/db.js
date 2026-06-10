const { Pool } = require('pg');
const dns      = require('dns');
const { URL }  = require('url');
require('dotenv').config();

const sslRequired =
  process.env.DB_SSL === 'true' ||
  (process.env.DATABASE_URL || '').includes('supabase');

// Render Free no tiene conectividad IPv6.
// Resolvemos el hostname de la URL a su registro A (IPv4) antes de crear el Pool.
function resolveIPv4Url(connectionString) {
  return new Promise((resolve) => {
    if (!connectionString) return resolve(connectionString);
    let url;
    try { url = new URL(connectionString); } catch { return resolve(connectionString); }

    dns.resolve4(url.hostname, (err, addresses) => {
      if (err || !addresses?.length) {
        console.warn('[DB] IPv4 resolve fallback — usando hostname original:', err?.message);
        return resolve(connectionString);
      }
      console.log(`[DB] Resuelto ${url.hostname} → ${addresses[0]}`);
      url.hostname = addresses[0];
      resolve(url.toString());
    });
  });
}

// Singleton: se crea una sola vez la primera vez que se usa.
let poolPromise = null;

function getPool() {
  if (!poolPromise) {
    poolPromise = resolveIPv4Url(process.env.DATABASE_URL).then((connStr) => {
      const p = new Pool({
        connectionString: connStr,
        ssl: sslRequired ? { rejectUnauthorized: false } : false,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 8000,
      });
      p.on('error', (err) => console.error('[DB] Pool error:', err.message));
      return p;
    });
  }
  return poolPromise;
}

// Exporta un objeto que delega query/connect al pool resuelto.
module.exports = {
  query:   (...args) => getPool().then(p => p.query(...args)),
  connect: (...args) => getPool().then(p => p.connect(...args)),
};
