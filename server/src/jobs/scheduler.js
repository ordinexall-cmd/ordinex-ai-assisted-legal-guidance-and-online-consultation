// ============================================================
// Ordinex - Background Job Scheduler
// Daily housekeeping tasks via node-cron.
//
// Currently runs:
//   - Subscription expiry sweep (daily 02:00 PHT)
//   - Booking auto-cancel sweep (every 30 min)
//   - Legal database auto-update (daily 00:00 PHT)
// ============================================================
import cron from 'node-cron';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { purgeExpiredAuthTokens } from '../services/sms.js';
import { purgeExpiredTrash } from '../services/recycleBin.js';
import { runLawScraper } from './lawScraper.js';

const AUTO_CANCEL_AFTER_MS = 48 * 60 * 60 * 1000; // 48 hours

/**
 * Mark expired subscriptions and clear their users' premium flag.
 * Idempotent - safe to run any number of times per day.
 */
export async function expireSubscriptions() {
  const now = new Date();
  const expired = await prisma.subscription.findMany({
    where: { status: 'ACTIVE', endDate: { lt: now } },
    select: { id: true, userId: true },
  });

  if (expired.length === 0) return { expired: 0 };

  await prisma.$transaction([
    prisma.subscription.updateMany({
      where: { id: { in: expired.map((s) => s.id) } },
      data: { status: 'EXPIRED' },
    }),
    prisma.user.updateMany({
      where: { id: { in: expired.map((s) => s.userId) } },
      data: { isPremium: false },
    }),
  ]);

  console.log(`[scheduler] Expired ${expired.length} subscription(s).`);
  return { expired: expired.length };
}

/**
 * Auto-cancel bookings that have been waiting on lawyer payment
 * verification for 48+ hours. Releases the slot back to the pool.
 *
 * Looks at PAYMENT_SUBMITTED bookings whose updatedAt is older
 * than the cutoff (updatedAt is touched when status flips to
 * PAYMENT_SUBMITTED, so it's effectively "submittedAt").
 */
export async function autoCancelStaleBookings() {
  const cutoff = new Date(Date.now() - AUTO_CANCEL_AFTER_MS);
  const stale = await prisma.booking.findMany({
    where: { status: 'PAYMENT_SUBMITTED', updatedAt: { lt: cutoff } },
    select: { id: true, availabilityId: true },
  });

  if (stale.length === 0) return { cancelled: 0 };

  for (const b of stale) {
    await prisma.$transaction([
      prisma.booking.update({
        where: { id: b.id },
        data: { status: 'AUTO_CANCELLED' },
      }),
      prisma.availability.update({
        where: { id: b.availabilityId },
        data: { isBooked: false, version: { increment: 1 } },
      }),
    ]);
  }

  console.log(`[scheduler] Auto-cancelled ${stale.length} stale booking(s).`);
  return { cancelled: stale.length };
}

/**
 * Auto-decline bookings stuck in REQUESTED (lawyer never responded).
 */
export async function expireStaleRequestedBookings() {
  const hours = env.REQUESTED_BOOKING_EXPIRE_HOURS;
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  const stale = await prisma.booking.findMany({
    where: { status: 'REQUESTED', createdAt: { lt: cutoff } },
    select: { id: true, availabilityId: true, citizenId: true },
  });

  if (stale.length === 0) return { expired: 0 };

  for (const b of stale) {
    await prisma.$transaction([
      prisma.booking.update({
        where: { id: b.id },
        data: { status: 'AUTO_CANCELLED' },
      }),
      prisma.availability.update({
        where: { id: b.availabilityId },
        data: { isBooked: false, version: { increment: 1 } },
      }),
    ]);
    const { createNotification } = await import('../services/notify.js');
    createNotification({
      userId: b.citizenId,
      title: 'Booking request expired',
      message: `The lawyer did not respond within ${hours} hours. The slot has been released.`,
      type: 'BOOKING_EXPIRED',
      linkTo: `/booking/${b.id}`,
    }).catch(() => {});
  }

  console.log(`[scheduler] Expired ${stale.length} REQUESTED booking(s).`);
  return { expired: stale.length };
}

/**
 * Auto-cancel APPROVED bookings that haven't been paid within 24 hours.
 * Uses approvedAt timestamp set when lawyer approves with quotedFee.
 */
export async function expireUnpaidApprovedBookings() {
  const hours = env.APPROVED_BOOKING_EXPIRE_HOURS;
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  const stale = await prisma.booking.findMany({
    where: {
      status: 'APPROVED',
      approvedAt: { not: null, lt: cutoff },
    },
    select: { id: true, availabilityId: true, citizenId: true, lawyerId: true },
  });

  if (stale.length === 0) return { expired: 0 };

  for (const b of stale) {
    await prisma.$transaction([
      prisma.booking.update({
        where: { id: b.id },
        data: { status: 'AUTO_CANCELLED' },
      }),
      prisma.availability.update({
        where: { id: b.availabilityId },
        data: { isBooked: false, version: { increment: 1 } },
      }),
    ]);
    const { createNotification } = await import('../services/notify.js');
    createNotification({
      userId: b.citizenId,
      title: 'Booking expired — payment not received',
      message: `Payment was not received within ${hours} hours. The slot has been released.`,
      type: 'BOOKING_EXPIRED',
      linkTo: `/booking/${b.id}`,
    }).catch(() => {});
    createNotification({
      userId: b.lawyerId,
      title: 'Booking expired — citizen did not pay',
      message: `The citizen did not complete payment within ${hours} hours. The slot is available again.`,
      type: 'BOOKING_EXPIRED',
      linkTo: `/booking/${b.id}`,
    }).catch(() => {});
  }

  console.log(`[scheduler] Expired ${stale.length} unpaid APPROVED booking(s).`);
  return { expired: stale.length };
}

/**
 * Wire all scheduled jobs. Call once at server startup.
 *   - Daily 02:00 PHT: subscription expiry
 *   - Every 30 min:    booking auto-cancel
 *
 * In dev mode both run once at startup so testing doesn't have
 * to wait until the next tick.
 */
export function startScheduler() {
  cron.schedule(
    '0 2 * * *',
    () => {
      expireSubscriptions().catch((err) =>
        console.error('[scheduler] expireSubscriptions failed:', err.message)
      );
      purgeExpiredTrash().catch((err) =>
        console.error('[scheduler] purgeExpiredTrash failed:', err.message)
      );
    },
    { timezone: 'Asia/Manila' }
  );

  cron.schedule('*/30 * * * *', () => {
    autoCancelStaleBookings().catch((err) =>
      console.error('[scheduler] autoCancelStaleBookings failed:', err.message)
    );
    expireStaleRequestedBookings().catch((err) =>
      console.error('[scheduler] expireStaleRequestedBookings failed:', err.message)
    );
    expireUnpaidApprovedBookings().catch((err) =>
      console.error('[scheduler] expireUnpaidApprovedBookings failed:', err.message)
    );
  });

  cron.schedule('*/15 * * * *', () => {
    purgeExpiredAuthTokens().catch((err) =>
      console.error('[scheduler] purgeExpiredAuthTokens failed:', err.message)
    );
  });

  // Daily legal database auto-update at 12:00 AM PHT.
  // We log the aggregate even on success so daily ops can grep for it.
  cron.schedule(
    '0 0 * * *',
    () => {
      runLawScraper()
        .then((report) => {
          if (report?.aggregate) {
            const { added, amended, unchanged, skipped } = report.aggregate;
            console.log(
              `[scheduler] Law scraper report — +${added} added, ↻${amended} amended, ` +
              `=${unchanged} unchanged, ×${skipped} skipped`,
            );
          }
        })
        .catch((err) =>
          console.error('[scheduler] runLawScraper failed:', err.message),
        );
    },
    { timezone: 'Asia/Manila' }
  );

  if (env.isDev) {
    expireSubscriptions().catch(() => {});
    purgeExpiredTrash().catch(() => {});
    autoCancelStaleBookings().catch(() => {});
    expireStaleRequestedBookings().catch(() => {});
    purgeExpiredAuthTokens().catch(() => {});
    expireUnpaidApprovedBookings().catch(() => {});
  }

  console.log('[scheduler] Cron jobs registered (sub expiry: daily 02:00 PHT; auto-cancel: every 30 min; law scraper: daily 00:00 PHT).');
}
