// POST /referidos/registrar  — el referidor registra al nuevo usuario que invitó
// POST /referidos/acreditar  — (interno / llamado por encuesta.js) acredita el bono
//                              cuando el referido completa su primera semana de encuesta
const { Router } = require('express');
const db    = require('../db');
const cache = require('../cache');
const {
  PUNTOS_REFERIDO,
  aplicarTecho,
} = require('../helpers/puntos');

const router = Router();

// ── POST /referidos/registrar ─────────────────────────────────────────────
// El usuario que refirió registra al nuevo. Los puntos se acreditan después,
// cuando el referido completa la primera semana.
router.post('/registrar', async (req, res) => {
  const { referrer_id, referred_id, ciclo_id } = req.body;

  if (!referrer_id || !referred_id || !ciclo_id) {
    return res.status(400).json({ error: 'referrer_id, referred_id y ciclo_id son requeridos.' });
  }
  if (referrer_id === referred_id) {
    return res.status(422).json({ error: 'No puedes referirte a ti mismo.' });
  }

  try {
    const cicloRow = await db.query(
      "SELECT id FROM ciclos WHERE id = $1 AND estado = 'active'",
      [ciclo_id]
    );
    if (!cicloRow.rowCount) return res.status(409).json({ error: 'Ciclo no activo.' });

    const { rows } = await db.query(
      `INSERT INTO referidos (referrer_id, referred_id, ciclo_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (referred_id) DO NOTHING
       RETURNING id, acreditado`,
      [referrer_id, referred_id, ciclo_id]
    );

    if (!rows.length) {
      return res.status(409).json({ error: 'Este usuario ya fue registrado como referido.' });
    }

    return res.status(201).json({
      referido_id:   rows[0].id,
      mensaje: 'Referido registrado. Los puntos se acreditarán cuando complete su primera semana.',
    });
  } catch (err) {
    console.error('[referidos/registrar]', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// ── Función interna: acredita bono al referidor si el referido terminó su semana 1.
// Llamada desde encuesta.js después de que el referred_id envía semana=1.
async function acreditarSiCorresponde(client, referredId) {
  // ¿Existe un referido no acreditado para este usuario?
  const refRow = await client.query(
    `SELECT id, referrer_id, ciclo_id
     FROM referidos
     WHERE referred_id = $1 AND acreditado = FALSE
     LIMIT 1
     FOR UPDATE`,
    [referredId]
  );
  if (!refRow.rowCount) return null;

  const { id: refId, referrer_id, ciclo_id } = refRow.rows[0];

  // Verifica que el referido realmente completó la semana 1 en este ciclo.
  const semana1 = await client.query(
    `SELECT 1 FROM puntos_eventos
     WHERE usuario_id = $1 AND ciclo_id = $2
       AND tipo = 'encuesta' AND metadata->>'semana' = '1'
     LIMIT 1`,
    [referredId, ciclo_id]
  );
  if (!semana1.rowCount) return null;

  // Aplica techo al referidor y otorga puntos.
  const puntosReales = await aplicarTecho(client, referrer_id, ciclo_id, PUNTOS_REFERIDO);

  if (puntosReales > 0) {
    await client.query(
      `INSERT INTO puntos_eventos (usuario_id, ciclo_id, tipo, puntos, metadata)
       VALUES ($1, $2, 'referido', $3, $4)`,
      [referrer_id, ciclo_id, puntosReales, JSON.stringify({ referred_id: referredId })]
    );
  }

  await client.query(
    `UPDATE referidos SET acreditado = TRUE, acreditado_at = NOW() WHERE id = $1`,
    [refId]
  );

  return { referrer_id, puntos_otorgados: puntosReales };
}

// ── GET /referidos/estado/:user_id ────────────────────────────────────────
router.get('/estado/:user_id', async (req, res) => {
  const { user_id } = req.params;
  const { ciclo_id } = req.query;

  try {
    const { rows } = await db.query(
      `SELECT r.id, r.referred_id, r.acreditado, r.acreditado_at, r.created_at,
              pe.puntos AS puntos_obtenidos
       FROM referidos r
       LEFT JOIN puntos_eventos pe
         ON pe.usuario_id = r.referrer_id AND pe.ciclo_id = r.ciclo_id
            AND pe.tipo = 'referido' AND pe.metadata->>'referred_id' = r.referred_id::text
       WHERE r.referrer_id = $1
         ${ciclo_id ? 'AND r.ciclo_id = $2' : ''}
       ORDER BY r.created_at DESC`,
      ciclo_id ? [user_id, ciclo_id] : [user_id]
    );

    return res.json({ referidos: rows });
  } catch (err) {
    console.error('[referidos/estado]', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

module.exports = router;
module.exports.acreditarSiCorresponde = acreditarSiCorresponde;
