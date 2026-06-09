// Scheduler centralizado: orquesta todos los cron jobs del ciclo mensual.
// Se ejecuta como proceso paralelo junto a app.js:
//   node src/scheduler.js
// O integrarlo en app.js importando este módulo al arrancar.
require('dotenv').config();
const cron = require('node-cron');

const abrirCiclo         = require('./jobs/ciclo-apertura');
const habilitarEncuesta  = require('./jobs/encuestas-habilitar');
const calcularRanking    = require('./jobs/ranking');          // nightly provisional
const cerrarCiclo        = require('./jobs/ciclo-cierre');
const rankingFinal       = require('./jobs/ranking-final');
const generarQRs         = require('./jobs/qr-generar');
const notificarGanadores = require('./jobs/notificaciones');
const reporteSponsor     = require('./jobs/reporte-sponsor');

function safe(nombre, fn) {
  return async () => {
    console.log(`[scheduler] Ejecutando: ${nombre}`);
    try { await fn(); }
    catch (err) { console.error(`[scheduler] Error en ${nombre}:`, err.message); }
  };
}

// ── Cronograma mensual ────────────────────────────────────────────────────
//
//  Expresión          Cuándo
//  "0 0 1 * *"        Día 1 del mes, 00:00
//  "0 8 * * 1"        Cada lunes, 08:00
//  "0 2 * * *"        Cada noche, 02:00
//  "59 23 L * *"      Último día del mes, 23:59  (node-cron v3 soporta L)
//  "0 1 1 * *"        Día 1 del mes, 01:00
//  "0 2 1 * *"        Día 1 del mes, 02:00
//  "0 9 1 * *"        Día 1 del mes, 09:00
//  "0 9 5 * *"        Día 5 del mes, 09:00

cron.schedule('0 0 1 * *',  safe('ciclo-apertura',        abrirCiclo));
cron.schedule('0 8 * * 1',  safe('encuestas-habilitar',   habilitarEncuesta));
cron.schedule('0 2 * * *',  safe('ranking-provisional',   calcularRanking));
cron.schedule('59 23 L * *',safe('ciclo-cierre',          cerrarCiclo));
cron.schedule('0 1 1 * *',  safe('ranking-final',         rankingFinal));
cron.schedule('0 2 1 * *',  safe('qr-generar',            generarQRs));
cron.schedule('0 9 1 * *',  safe('notificaciones-ganadores', notificarGanadores));
cron.schedule('0 9 5 * *',  safe('reporte-sponsor',       reporteSponsor));

console.log('[scheduler] Todos los cron jobs registrados. Esperando disparos…');
console.table([
  { job: 'ciclo-apertura',          cron: '0 0 1 * *',   desc: 'Día 1 - 00:00' },
  { job: 'encuestas-habilitar',     cron: '0 8 * * 1',   desc: 'Cada lunes - 08:00' },
  { job: 'ranking-provisional',     cron: '0 2 * * *',   desc: 'Cada noche - 02:00' },
  { job: 'ciclo-cierre',            cron: '59 23 L * *', desc: 'Último día - 23:59' },
  { job: 'ranking-final',           cron: '0 1 1 * *',   desc: 'Día 1 sig. - 01:00' },
  { job: 'qr-generar',              cron: '0 2 1 * *',   desc: 'Día 1 sig. - 02:00' },
  { job: 'notificaciones-ganadores',cron: '0 9 1 * *',   desc: 'Día 1 sig. - 09:00' },
  { job: 'reporte-sponsor',         cron: '0 9 5 * *',   desc: 'Día 5 sig. - 09:00' },
]);
