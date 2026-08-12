// ============================================================
// Ordinex — Transactional SMS (non-OTP)
// ============================================================
import { env } from '../config/env.js';

/**
 * Alert lawyer of a new booking request via SMS when Semaphore is configured.
 * @param {{ phone?: string, name?: string }} lawyer
 */
export async function notifyLawyerBookingRequest(lawyer, citizenName) {
  if (!lawyer?.phone || !env.SEMAPHORE_API_KEY) return;

  const message = `ORDINEX: New booking request from ${citizenName}. Sign in to approve or decline.`;

  if (env.isDev) {
    console.log(`\n📱 Booking alert → ${lawyer.phone}: ${message}\n`);
    return;
  }

  await fetch('https://api.semaphore.co/api/v4/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apikey: env.SEMAPHORE_API_KEY,
      number: lawyer.phone,
      message,
      sendername: env.SEMAPHORE_SENDER_NAME,
    }),
  });
}
