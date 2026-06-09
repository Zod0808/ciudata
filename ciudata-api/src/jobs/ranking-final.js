// [Día 1 mes sig. - 01:00] Calcula el ranking final del ciclo cerrado
// e inserta los resultados en ranking_mensual.
// Cron: "0 1 1 * *"
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const db = require('../db');

async function calcularRankingFinal() {
  console.log('[ranking-final] Calculando ranking final…');

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Toma el ciclo cerrado más reciente que aún no tenga ranking_mensual.
    const cicloRow = await client.query(
      `SELECT c.id, c.mes, c.anio
       FROM ciclos c
       WHERE c.estado = 'closed'
         AND NOT EXISTS (
           SELECT 1 FROM ranking_mensual rm WHERE rm.ciclo_id = c.id
         )
       ORDER BY c.anio DESC, c.mes DESC
       LIMIT 1`
    );

    if (!cicloRow.rowCount) {
      console.log('[ranking-final] No hay ciclo cerrado pendiente — skip.');
      await client.query('ROLLBACK');
      return null;
    }

    const { id: cicloId, mes, anio } = cicloRow.rows[0];

    const { rows: ranking } = await client.query(
      `SELECT
         usuario_id,
         SUM(puntos) AS total_puntos,
         RANK() OVER (ORDER BY SUM(puntos) DESC) AS posicion
       FROM puntos_eventos
       WHERE ciclo_id = $1
       GROUP BY usuario_id
       ORDER BY total_puntos DESC`,
      [cicloId]
    );

    if (!ranking.length) {
      console.log(`[ranking-final] Ciclo ${mes}/${anio} sin participantes — skip.`);
      await client.query('ROLLBACK');
      return null;
    }

    // Inserción masiva en ranking_mensual.
    const values = ranking
      .map((r, i) => `($1, $${i * 3 + 2}, $${i * 3 + 3}, $${i * 3 + 4})`)
      .join(', ');
    const params = [cicloId];
    ranking.forEach(r => params.push(r.usuario_id, r.posicion, r.total_puntos));

    await client.query(
      `INSERT INTO ranking_mensual (ciclo_id, usuario_id, posicion, total_puntos) VALUES ${values}
       ON CONFLICT (ciclo_id, usuario_id) DO NOTHING`,
      params
    );

    // Marca el ciclo como rewarded.
    await client.query(
      "UPDATE ciclos SET estado = 'rewarded' WHERE id = $1",
      [cicloId]
    );

    await client.query('COMMIT');
    console.log(`[ranking-final] Ciclo ${mes}/${anio}: ${ranking.length} usuarios rankeados.`);
    return { cicloId, top10: ranking.slice(0, 10) };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ranking-final] Error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  calcularRankingFinal().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = calcularRankingFinal;
