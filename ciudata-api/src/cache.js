const Redis = require('ioredis');
require('dotenv').config();

let client = null;

if (process.env.REDIS_URL) {
  client = new Redis(process.env.REDIS_URL, { lazyConnect: true, enableOfflineQueue: false });
  client.on('error', (err) => console.warn('[Redis] Connection error:', err.message));
  client.connect().catch(() => { client = null; });
}

const RANKING_TTL = parseInt(process.env.RANKING_CACHE_TTL || '3600', 10);

async function getRanking(cicloId) {
  if (!client) return null;
  try {
    const raw = await client.get(`ranking:${cicloId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

async function setRanking(cicloId, data) {
  if (!client) return;
  try {
    await client.set(`ranking:${cicloId}`, JSON.stringify(data), 'EX', RANKING_TTL);
  } catch { /* non-fatal */ }
}

async function invalidateRanking(cicloId) {
  if (!client) return;
  try { await client.del(`ranking:${cicloId}`); } catch { /* non-fatal */ }
}

module.exports = { getRanking, setRanking, invalidateRanking };
