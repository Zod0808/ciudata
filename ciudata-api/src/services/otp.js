// Servicio OTP: generación CSPRNG + envío SMS (Twilio en producción, consola en dev).
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const BCRYPT_ROUNDS = 10;
const OTP_TTL_MIN   = 5;
const MAX_INTENTOS  = 3;

// ── Genera un código de 6 dígitos criptográficamente seguro ──────────────
function generarCodigoOTP() {
  // randomBytes(3) → 3 bytes → 24 bits; mapeamos al rango [100000, 999999]
  const bytes = crypto.randomBytes(3);
  const n = bytes.readUIntBE(0, 3) % 900000 + 100000;
  return String(n);
}

// ── Hashea el código para almacenarlo en BD ──────────────────────────────
async function hashOTP(codigo) {
  return bcrypt.hash(codigo, BCRYPT_ROUNDS);
}

async function verificarHashOTP(codigo, hash) {
  return bcrypt.compare(codigo, hash);
}

// ── Envío de SMS ─────────────────────────────────────────────────────────
async function enviarSMS(phone, codigo) {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    const twilio = require('twilio')(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    await twilio.messages.create({
      body: `Tu código CIUDATA es: ${codigo}. Válido por ${OTP_TTL_MIN} minutos. No lo compartas.`,
      to:   phone,
      from: process.env.TWILIO_FROM_NUMBER,
    });
    return { canal: 'sms' };
  }

  // Modo desarrollo: imprime en consola en lugar de enviar SMS.
  console.log(`\n[OTP-DEV] ─────────────────────────`);
  console.log(`  Teléfono : ${phone}`);
  console.log(`  Código   : ${codigo}`);
  console.log(`  Expira en: ${OTP_TTL_MIN} min`);
  console.log(`────────────────────────────────────\n`);
  return { canal: 'console_dev' };
}

module.exports = {
  generarCodigoOTP,
  hashOTP,
  verificarHashOTP,
  enviarSMS,
  OTP_TTL_MIN,
  MAX_INTENTOS,
};
