// [Día 1 mes sig. - 02:00] Genera tokens QR criptográficos para el Top 10 del ciclo premiado.
// Distribución: Rank 1 → 100% (gratis), Ranks 2-3 → 50%, Ranks 4-10 → 30%
// Cron: "0 2 1 * *"
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const crypto = require('crypto');
const db = require('../db');

const DIAS_VIGENCIA_QR = 30;

function tipoDescuento(posicion) {
  if (posicion === 1)                return '100';
  if (posicion >= 2 && posicion <= 3) return '50';
  return '30';
}

async function generarQRs() {
  console.log('[qr-generar] Generando QRs para Top 10…');

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Ciclo en estado 'rewarded' más reciente sin QRs generados.
    const cicloRow = await client.query(
      `SELECT c.id, c.mes, c.anio
       FROM ciclos c
       WHERE c.estado = 'rewarded'
         AND NOT EXISTS (
           SELECT 1 FROM codigos_qr qr WHERE qr.ciclo_id = c.id
         )
       ORDER BY c.anio DESC, c.mes DESC
       LIMIT 1`
    );

    if (!cicloRow.rowCount) {
      console.log('[qr-generar] No hay ciclo premiado sin QRs — skip.');
      await client.query('ROLLBACK');
      return [];
    }

    const { id: cicloId, mes, anio } = cicloRow.rows[0];

    const { rows: top10 } = await client.query(
      `SELECT usuario_id, posicion
       FROM ranking_mensual
       WHERE ciclo_id = $1 AND posicion <= 10
       ORDER BY posicion ASC`,
      [cicloId]
    );

    if (!top10.length) {
      console.log('[qr-generar] Top 10 vacío — skip.');
      await client.query('ROLLBACK');
      return [];
    }

    const expiresAt = new Date(Date.now() + DIAS_VIGENCIA_QR * 24 * 60 * 60 * 1000);
    const qrsCreados = [];

    for (const ganador of top10) {
      // Token criptográfico de 48 bytes → 96 chars hex, prefijado con ciclo/posición.
      const token = `CZ${mes}${String(anio).slice(2)}-${crypto.randomBytes(24).toString('hex').toUpperCase()}`;
      const tipo  = tipoDescuento(ganador.posicion);

      await client.query(
        `INSERT INTO codigos_qr (token, usuario_id, ciclo_id, tipo_descuento, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [token, ganador.usuario_id, cicloId, tipo, expiresAt]
      );
      qrsCreados.push({ usuario_id: ganador.usuario_id, posicion: ganador.posicion, tipo, token });
    }

    await client.query('COMMIT');
    console.log(`[qr-generar] ${qrsCreados.length} QRs generados para ciclo ${mes}/${anio}.`);
    return qrsCreados;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[qr-generar] Error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  generarQRs().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = generarQRs;
