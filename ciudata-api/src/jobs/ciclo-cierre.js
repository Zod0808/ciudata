// [Último día del mes - 23:59] Cierra el ciclo activo y congela la acumulación de puntos.
// Cron: "59 23 L * *"   (node-cron soporta L = último día del mes)
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const db = require('../db');

async function cerrarCiclo() {
  console.log('[ciclo-cierre] Cerrando ciclo activo…');

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const cicloRow = await client.query(
      "SELECT id, mes, anio FROM ciclos WHERE estado = 'active' ORDER BY created_at DESC LIMIT 1 FOR UPDATE"
    );
    if (!cicloRow.rowCount) {
      console.log('[ciclo-cierre] No hay ciclo activo — skip.');
      await client.query('ROLLBACK');
      return;
    }

    const { id, mes, anio } = cicloRow.rows[0];

    // Desactiva todas las encuestas pendientes del ciclo.
    await client.query(
      "UPDATE encuestas SET activa = FALSE WHERE ciclo_id = $1",
      [id]
    );

    await client.query(
      "UPDATE ciclos SET estado = 'closed' WHERE id = $1",
      [id]
    );

    await client.query('COMMIT');
    console.log(`[ciclo-cierre] Ciclo ${mes}/${anio} (${id}) cerrado.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ciclo-cierre] Error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  cerrarCiclo().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = cerrarCiclo;
