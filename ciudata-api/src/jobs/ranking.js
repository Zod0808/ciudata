// Job nocturno: calcula el ranking provisional y lo almacena en Redis (TTL 1h).
// Programar con cron: "0 2 * * *" (02:00 AM diario) o como worker en Railway/Render.
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const db = require('../db');
const cache = require('../cache');

async function calcularRankingProvisional() {
  console.log('[ranking-job] Iniciando cálculo de rankings provisionales…');

  try {
    const { rows: ciclosActivos } = await db.query(
      "SELECT id FROM ciclos WHERE estado = 'active'"
    );

    for (const ciclo of ciclosActivos) {
      const { rows } = await db.query(
        `SELECT
           usuario_id,
           SUM(puntos) AS total_puntos,
           RANK() OVER (ORDER BY SUM(puntos) DESC) AS posicion
         FROM puntos_eventos
         WHERE ciclo_id = $1
         GROUP BY usuario_id
         ORDER BY total_puntos DESC`,
        [ciclo.id]
      );

      await cache.setRanking(ciclo.id, rows);
      console.log(`[ranking-job] Ciclo ${ciclo.id}: ${rows.length} usuarios indexados.`);
    }

    console.log('[ranking-job] Completado.');
  } catch (err) {
    console.error('[ranking-job] Error:', err.message);
    process.exit(1);
  } finally {
    await db.end();
    process.exit(0);
  }
}

calcularRankingProvisional();
