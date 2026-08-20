// ============================================================
// Ordinex — DB-backed OTP (delivered by email, not SMS)
// ============================================================
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

/**
 * Store a hashed OTP against phone or email. Delivery is Gmail SMTP.
 * @param {string} identifier
 * @param {string} code
 * @param {'REGISTER'|'RESET_PASSWORD'|'CHANGE_PASSWORD'|'CHANGE_EMAIL'|'CHANGE_PHONE'} purpose
 */
export async function sendOTP(identifier, code, purpose = 'REGISTER') {
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.otpChallenge.upsert({
    where: { phone_purpose: { phone: identifier, purpose } },
    create: { phone: identifier, purpose, codeHash, expiresAt },
    update: { codeHash, attempts: 0, expiresAt },
  });

  if (!env.isProd) {
    console.log(`\n🔐 ═══ OTP FOR ${identifier} (${purpose}) ═══`);
    console.log(`   Code: ${code}`);
    console.log(`   Expires: 5 minutes`);
    console.log(`   ═══════════════════════\n`);
  }

  return true;
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
