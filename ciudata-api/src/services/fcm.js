// Firebase Cloud Messaging — wrapper sobre firebase-admin.
// Requiere FIREBASE_SERVICE_ACCOUNT_JSON en .env (JSON del service account de FCM).
let admin = null;

function init() {
  if (admin) return;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) {
    console.warn('[FCM] FIREBASE_SERVICE_ACCOUNT_JSON no configurado — notificaciones deshabilitadas.');
    return;
  }
  try {
    admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(JSON.parse(json)) });
    }
  } catch (err) {
    console.error('[FCM] Error inicializando firebase-admin:', err.message);
    admin = null;
  }
}

async function enviar(fcmToken, title, body, data = {}) {
  init();
  if (!admin || !fcmToken) return { skipped: true };

  try {
    const response = await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      android: { priority: 'high' },
    });
    return { messageId: response };
  } catch (err) {
    // Token inválido o expirado — no es un error fatal del job.
    console.warn(`[FCM] Falló envío a token ${fcmToken.slice(0, 12)}…: ${err.message}`);
    return { error: err.message };
  }
}

module.exports = { enviar };
