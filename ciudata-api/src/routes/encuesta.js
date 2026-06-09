// POST /encuesta/responder
// +10 pts por pregunta respondida (máx 4 preguntas = 40 pts/semana).
// Idempotente por semana (no por ciclo completo).
// Al completar las 4 semanas del ciclo → bonus de racha +20 pts (1 vez por ciclo).
const { Router } = require('express');
const db    = require('../db');
const cache = require('../cache');
const {
  PUNTOS_POR_PREGUNTA,
  PREGUNTAS_POR_SEMANA,
  PUNTOS_RACHA,
  SEMANAS_CICLO,
  aplicarTecho,
  semanasConEncuesta,
  yaOtorgadaRacha,
} = require('../helpers/puntos');
// Acreditación de referido: se dispara cuando semana=1 del referido es completada.
const { acreditarSiCorresponde } = require('./referidos');

const router = Router();

router.post('/responder', async (req, res) => {
  const { usuario_id, ciclo_id, semana, respuestas } = req.body;

  if (!usuario_id || !ciclo_id || !semana || !Array.isArray(respuestas) || !respuestas.length) {
    return res.status(400).json({
      error: 'usuario_id, ciclo_id, semana y respuestas[] son requeridos.',
    });
  }

  // Debe enviar exactamente las 4 preguntas de la semana.
  if (respuestas.length !== PREGUNTAS_POR_SEMANA) {
    return res.status(422).json({
      error: `Debes responder las ${PREGUNTAS_POR_SEMANA} preguntas de la semana (recibidas: ${respuestas.length}).`,
    });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // ── Ciclo activo ──────────────────────────────────────────────────────
    const cicloRow = await client.query(
      "SELECT id FROM ciclos WHERE id = $1 AND estado = 'active'",
      [ciclo_id]
    );
    if (!cicloRow.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Ciclo no activo.' });
    }

    // ── Idempotencia semanal: una sola respuesta por semana ───────────────
    const existing = await client.query(
      `SELECT id FROM puntos_eventos
       WHERE usuario_id = $1 AND ciclo_id = $2
         AND tipo = 'encuesta' AND metadata->>'semana' = $3
       LIMIT 1`,
      [usuario_id, ciclo_id, String(semana)]
    );
    if (existing.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Semana ${semana} ya respondida en este ciclo.` });
    }

    // ── Techo mensual: calcula puntos reales a otorgar ────────────────────
    const puntosBase = PUNTOS_POR_PREGUNTA * PREGUNTAS_POR_SEMANA; // 40
    const puntosReales = await aplicarTecho(client, usuario_id, ciclo_id, puntosBase);

    // ── Inserta evento de encuesta ────────────────────────────────────────
    const { rows } = await client.query(
      `INSERT INTO puntos_eventos (usuario_id, ciclo_id, tipo, puntos, metadata)
       VALUES ($1, $2, 'encuesta', $3, $4)
       RETURNING id, puntos, created_at`,
      [
        usuario_id, ciclo_id, puntosReales,
        JSON.stringify({ semana, respuestas }),
      ]
    );

    const eventoId  = rows[0].id;
    const puntosOtorgados = rows[0].puntos;
    let   rachaOtorgada   = false;
    let   puntosRacha     = 0;

    // ── Racha mensual: si ya completó las 4 semanas y no tiene bono ───────
    const semanas = await semanasConEncuesta(client, usuario_id, ciclo_id);
    if (semanas >= SEMANAS_CICLO && !(await yaOtorgadaRacha(client, usuario_id, ciclo_id))) {
      puntosRacha = await aplicarTecho(client, usuario_id, ciclo_id, PUNTOS_RACHA);
      if (puntosRacha > 0) {
        await client.query(
          `INSERT INTO puntos_eventos (usuario_id, ciclo_id, tipo, puntos, metadata)
           VALUES ($1, $2, 'encuesta', $3, '{"es_racha": true}')`,
          [usuario_id, ciclo_id, puntosRacha]
        );
        rachaOtorgada = true;
      }
    }

    // ── Acreditación de referido si el usuario acaba de terminar semana 1 ──
    let referidoAcreditado = null;
    if (Number(semana) === 1) {
      referidoAcreditado = await acreditarSiCorresponde(client, usuario_id);
    }

    await client.query('COMMIT');
    await cache.invalidateRanking(ciclo_id);

    return res.status(201).json({
      evento_id:          eventoId,
      semana,
      puntos_otorgados:   puntosOtorgados,
      racha_completada:   rachaOtorgada,
      puntos_racha:       puntosRacha,
      referido_acreditado: referidoAcreditado,
      techo_mensual:      350,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[encuesta/responder]', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  } finally {
    client.release();
  }
});

module.exports = router;
