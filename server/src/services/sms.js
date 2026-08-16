// ============================================================
// Ordinex — SMS Service (Semaphore) + DB-backed OTP
// ============================================================
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { toSemaphoreNumber } from '../utils/phonePhilippines.js';

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

/**
 * @param {'REGISTER'|'RESET_PASSWORD'} purpose
 */
export async function sendOTP(phone, code, purpose = 'REGISTER') {
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.otpChallenge.upsert({
    where: { phone_purpose: { phone, purpose } },
    create: { phone, purpose, codeHash, expiresAt },
    update: { codeHash, attempts: 0, expiresAt },
  });

  if (phone.includes('@') || env.isDev || !process.env.SEMAPHORE_API_KEY) {
    console.log(`\n🔐 ═══ OTP FOR ${phone} (${purpose}) ═══`);
    console.log(`   Code: ${code}`);
    console.log(`   Expires: 5 minutes`);
    console.log(`   ═══════════════════════\n`);
    return true;
  }

  const semaphoreNumber = toSemaphoreNumber(phone);
  if (!semaphoreNumber) {
    console.error('Semaphore SMS error: invalid phone for', phone);
    return false;
  }

  try {
    const response = await fetch('https://api.semaphore.co/api/v4/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: process.env.SEMAPHORE_API_KEY,
        number: semaphoreNumber,
        message: `Your ORDINEX verification code is: ${code}. Valid for 5 minutes. Do not share this code.`,
        sendername: process.env.SEMAPHORE_SENDER_NAME || 'ORDINEX',
      }),
    });

    const bodyText = await response.text();
    if (!response.ok) {
      console.error('Semaphore SMS error:', response.status, bodyText);
      return false;
    }

    let parsed;
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      console.error('Semaphore SMS unexpected response:', bodyText);
      return false;
    }

    const results = Array.isArray(parsed) ? parsed : [parsed];
    const ok = results.every((r) => {
      const status = String(r?.status || '').toLowerCase();
      return status === 'queued' || status === 'pending' || status === 'sent' || r?.message_id != null;
    });
    if (!ok) {
      console.error('Semaphore SMS delivery not queued:', parsed);
      return false;
    }

    const ids = results.map((r) => r?.message_id).filter(Boolean);
    console.log(`[sms] OTP queued for ${semaphoreNumber} (${purpose}) message_id=${ids.join(',')}`);
    return true;
  } catch (error) {
    console.error('SMS send failed:', error);
    return false;
  }
}

/**
 * @param {'REGISTER'|'RESET_PASSWORD'} purpose
 * @returns {Promise<{ valid: boolean, error?: string }>}
 */
const PANEL_DEMO_PHONE = '09178888888';
const PANEL_DEMO_OTP = '000000';

export async function verifyOTP(phone, code, purpose = 'REGISTER', { panelDemo = false } = {}) {
  const isDev = (process.env.NODE_ENV || 'development') !== 'production';
  if (
    isDev &&
    purpose === 'REGISTER' &&
    String(code).trim() === PANEL_DEMO_OTP &&
    (phone === PANEL_DEMO_PHONE || panelDemo)
  ) {
    const stored = await prisma.otpChallenge.findUnique({
      where: { phone_purpose: { phone, purpose } },
    });
    if (stored) {
      await prisma.otpChallenge.delete({ where: { id: stored.id } });
    }
    return { valid: true, panelBypass: true };
  }

  const stored = await prisma.otpChallenge.findUnique({
    where: { phone_purpose: { phone, purpose } },
  });

  if (!stored) {
    return { valid: false, error: 'No OTP found. Please request a new code.' };
  }

  if (stored.expiresAt < new Date()) {
    await prisma.otpChallenge.delete({ where: { id: stored.id } });
    return { valid: false, error: 'OTP expired. Please request a new code.' };
  }

  if (stored.attempts >= MAX_ATTEMPTS) {
    await prisma.otpChallenge.delete({ where: { id: stored.id } });
    return { valid: false, error: 'Too many failed attempts. Please request a new code.' };
  }

  const match = await bcrypt.compare(code, stored.codeHash);
  if (!match) {
    await prisma.otpChallenge.update({
      where: { id: stored.id },
      data: { attempts: { increment: 1 } },
    });
    return { valid: false, error: 'Invalid OTP code. Please try again.' };
  }

  await prisma.otpChallenge.delete({ where: { id: stored.id } });
  return { valid: true };
}

/** Remove expired OTP rows and stale pending registrations. */
export async function purgeExpiredAuthTokens() {
  const now = new Date();
  const [otps, pending] = await Promise.all([
    prisma.otpChallenge.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.pendingRegistration.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
  return { otps: otps.count, pending: pending.count };
}
