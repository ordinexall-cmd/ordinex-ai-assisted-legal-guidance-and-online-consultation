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
        data: { status: 'AUTO_CANCELLED', briefInquiryId: null },
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
        data: { status: 'AUTO_CANCELLED', briefInquiryId: null },
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
        data: { status: 'AUTO_CANCELLED', briefInquiryId: null },
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

function getSlotStartDateTime(date, startTimeStr) {
  const d = new Date(date);
  if (!startTimeStr) return d;
  const match = startTimeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return d;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/**
 * 15-Minute consultation reminders sweep.
 * Runs every 5 minutes; detects CONFIRMED sessions starting in the next ~15-20 min.
 */
export async function send15MinConsultationReminders() {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const bookings = await prisma.booking.findMany({
    where: {
      status: 'CONFIRMED',
      reminder15MinSent: false,
      availability: {
        date: { gte: todayStart, lte: todayEnd },
      },
    },
    include: {
      availability: true,
      citizen: { select: { id: true, name: true, email: true, phone: true } },
      lawyer: { select: { id: true, name: true, email: true, phone: true } },
    },
  });

  if (bookings.length === 0) return { reminded: 0 };

  let count = 0;
  for (const b of bookings) {
    const slotStart = getSlotStartDateTime(b.availability.date, b.availability.startTime);
    const diffMs = slotStart.getTime() - now.getTime();
    const diffMins = diffMs / (60 * 1000);

    if (diffMins >= 12 && diffMins <= 18) {
      await prisma.booking.update({
        where: { id: b.id },
        data: { reminder15MinSent: true },
      });

      const preflightLink = `/consultation/${b.id}/preflight`;
      createNotification({
        userId: b.citizenId,
        title: 'Consultation starting in 15 minutes',
        message: `Your video consultation with Atty. ${b.lawyer.name} starts soon (${b.availability.startTime}). Complete device check and review policies before joining.`,
        type: 'CONSULTATION_REMINDER',
        linkTo: preflightLink,
      }).catch(() => {});

      createNotification({
        userId: b.lawyerId,
        title: 'Consultation starting in 15 minutes',
        message: `Your consultation with ${b.citizen.name} starts soon (${b.availability.startTime}). Prepare your session and review preflight policies.`,
        type: 'CONSULTATION_REMINDER',
        linkTo: preflightLink,
      }).catch(() => {});

      count++;
    }
  }

  if (count > 0) {
    console.log(`[scheduler] Sent 15-min reminders for ${count} consultation(s).`);
  }
  return { reminded: count };
}

/**
 * Flag CONFIRMED consultations where slot start was 15+ min ago and nobody joined.
 */
export async function flagStaleConsultations() {
  const now = new Date();
  const bookings = await prisma.booking.findMany({
    where: {
      status: 'CONFIRMED',
      awaitingJoinActionAt: null,
    },
    include: {
      availability: true,
      citizen: { select: { id: true, name: true } },
      lawyer: { select: { id: true, name: true } },
    },
  });

  let count = 0;
  for (const b of bookings) {
    const slotStart = getSlotStartDateTime(b.availability.date, b.sessionStartTime || b.availability.startTime);
    const diffMs = now.getTime() - slotStart.getTime();
    if (diffMs < 15 * 60 * 1000) continue;

    await prisma.booking.update({
      where: { id: b.id },
      data: { awaitingJoinActionAt: now },
    });

    const link = `/booking/${b.id}`;
    const msg = 'Nobody joined the scheduled consultation. Continue waiting, reschedule, or cancel for a refund.';
    createNotification({
      userId: b.citizenId,
      title: 'Consultation needs action',
      message: msg,
      type: 'BOOKING_UPDATE',
      linkTo: link,
    }).catch(() => {});
    createNotification({
      userId: b.lawyerId,
      title: 'Consultation needs action',
      message: msg,
      type: 'BOOKING_UPDATE',
      linkTo: link,
    }).catch(() => {});
    count++;
  }

  if (count > 0) {
    console.log(`[scheduler] Flagged ${count} stale consultation(s) for join action.`);
  }
  return { flagged: count };
}

/**
 * Wire all scheduled jobs. Call once at server startup.
 *   - Daily 02:00 PHT: subscription expiry
 *   - Every 30 min:    booking auto-cancel
 *   - Every 5 min:     15-min consultation reminders
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

  // Check 15-minute consultation reminders every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    send15MinConsultationReminders().catch((err) =>
      console.error('[scheduler] send15MinConsultationReminders failed:', err.message)
    );
    flagStaleConsultations().catch((err) =>
      console.error('[scheduler] flagStaleConsultations failed:', err.message)
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
