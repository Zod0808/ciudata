// [Día 1 - 00:00] Abre un nuevo ciclo mensual y lo vincula al sponsor activo.
// Cron: "0 0 1 * *"
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const db = require('../db');

async function abrirCiclo() {
  const ahora = new Date();
  const mes  = ahora.getMonth() + 1; // 1-12
  const anio = ahora.getFullYear();

  console.log(`[ciclo-apertura] Abriendo ciclo ${mes}/${anio}…`);

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Evita duplicados si el job se ejecuta más de una vez.
    const existe = await client.query(
      'SELECT id FROM ciclos WHERE mes = $1 AND anio = $2',
      [mes, anio]
    );
    if (existe.rowCount) {
      console.log(`[ciclo-apertura] Ciclo ${mes}/${anio} ya existe — skip.`);
      await client.query('ROLLBACK');
      return;
    }

    // Selecciona el sponsor activo más antiguo sin ciclo asignado este mes.
    const sponsorRow = await client.query(
      "SELECT id, nombre FROM sponsors WHERE activo = TRUE ORDER BY created_at ASC LIMIT 1"
    );

    const sponsorId     = sponsorRow.rows[0]?.id     || null;
    const sponsorNombre = sponsorRow.rows[0]?.nombre || null;

    const { rows } = await client.query(
      `INSERT INTO ciclos (mes, anio, estado, sponsor_id_fk, sponsor_nombre)
       VALUES ($1, $2, 'active', $3, $4)
       RETURNING id`,
      [mes, anio, sponsorId, sponsorNombre]
    );

    await client.query('COMMIT');
    console.log(`[ciclo-apertura] Ciclo creado: ${rows[0].id} (sponsor: ${sponsorNombre || 'ninguno'})`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ciclo-apertura] Error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  abrirCiclo().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = abrirCiclo;
