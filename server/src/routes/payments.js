// ============================================================
// Ordinex — Platform Payment Routes
// Simulated confirm + PayMongo Checkout (GCash-first).
// ============================================================
import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../config/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { createNotification } from '../services/notify.js';
import {
  createCheckoutSession,
  isPaymongoMode,
  retrieveCheckoutSession,
  verifyPaymongoSignature,
} from '../services/paymongo.js';

import { isDemoEmail } from '../../prisma/demoAccounts.js';

const router = Router();

function commissionPctLabel() {
  return `${Math.round(env.PLATFORM_COMMISSION_RATE * 100)}%`;
}

function methodFromPaymongo(type) {
  const t = String(type || '').toLowerCase();
  if (t.includes('gcash')) return 'GCASH';
  if (t.includes('maya') || t.includes('paymaya')) return 'MAYA';
  if (t.includes('card')) return 'CARD';
  return 'GCASH';
}

/**
 * Finalize APPROVED booking → CONFIRMED + wallet credit (idempotent by key).
 */
async function finalizeBookingPayment({
  bookingId,
  citizenId,
  citizenName,
  idempotencyKey,
  method,
  providerPaymentId = null,
}) {
  const existing = await prisma.payment.findUnique({ where: { idempotencyKey } });
  if (existing) {
    return { alreadyProcessed: true, paymentId: existing.id };
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { lawyer: { select: { id: true, name: true } } },
  });
  if (!booking) {
    const err = new Error('Booking not found.');
    err.status = 404;
    throw err;
  }
  if (booking.citizenId !== citizenId) {
    const err = new Error('You do not have access to this booking.');
    err.status = 403;
    throw err;
  }
  if (booking.status === 'CONFIRMED' && booking.paymentId) {
    return { alreadyProcessed: true, paymentId: booking.paymentId };
  }
  if (booking.status !== 'APPROVED') {
    const err = new Error('Booking must be in APPROVED status to pay.');
    err.status = 409;
    throw err;
  }
  if (!booking.quotedFee || booking.quotedFee <= 0) {
    const err = new Error('No quoted fee set for this booking.');
    err.status = 409;
    throw err;
  }

  const quotedFee = booking.quotedFee;
  const platformFee = Math.round(quotedFee * env.PLATFORM_COMMISSION_RATE * 100) / 100;
  const lawyerShare = quotedFee - platformFee;
  const total = quotedFee;

  const payment = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: {
        idempotencyKey,
        type: 'BOOKING',
        amount: total,
        platformFee,
        method: method || 'GCASH',
        status: 'COMPLETED',
        userId: citizenId,
        bookingId,
      },
    });

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CONFIRMED',
        paymentId: p.id,
        platformFee,
        lawyerShare,
        feeAtBooking: quotedFee,
        paymentVerifiedAt: new Date(),
        roomId: booking.roomId || crypto.randomUUID(),
        ...(providerPaymentId ? { paymentReference: providerPaymentId } : {}),
      },
    });

    await tx.user.update({
      where: { id: booking.lawyerId },
      data: { walletPending: { increment: lawyerShare } },
    });

    return p;
  });

  createNotification({
    userId: booking.lawyerId,
    title: 'Payment held — session confirmed',
    message: `${citizenName || 'Citizen'} paid. Funds are held by Ordinex until you close the case after the consultation.`,
    type: 'BOOKING_STATUS',
    linkTo: `/booking/${bookingId}`,
  }).catch(() => {});

  createNotification({
    userId: citizenId,
    title: 'Payment received — held until consult ends',
    message: 'Your payment is held by Ordinex (not sent to the lawyer yet). Chat is unlocked. If cancelled before the session, you get a refund.',
    type: 'BOOKING_STATUS',
    linkTo: `/booking/${bookingId}`,
  }).catch(() => {});

  return { alreadyProcessed: false, paymentId: payment.id };
}

// ======================== CHECKOUT CONTEXT ========================
router.get('/checkout-context', requireAuth, async (req, res, next) => {
  try {
    const { type, bookingId } = req.query;

    if (type === 'subscription') {
      return res.status(410).json({
        error: 'Platform subscriptions are no longer offered. Pay lawyers at booking time.',
        code: 'SUBSCRIPTION_REMOVED',
      });
    }

    if (type === 'booking') {
      if (!bookingId) {
        return res.status(400).json({ error: 'bookingId is required for booking checkout.' });
      }
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          lawyer: { select: { id: true, name: true } },
        },
      });
      if (!booking) return res.status(404).json({ error: 'Booking not found.' });
      if (booking.citizenId !== req.user.id) {
        return res.status(403).json({ error: 'You do not have access to this booking.' });
      }
      if (booking.status !== 'APPROVED') {
        return res.status(409).json({ error: 'Booking must be in APPROVED status to pay.' });
      }
      if (!booking.quotedFee || booking.quotedFee <= 0) {
        return res.status(409).json({ error: 'No quoted fee on this booking.' });
      }

      const quotedFee = booking.quotedFee;
      const platformFee = Math.round(quotedFee * env.PLATFORM_COMMISSION_RATE * 100) / 100;
      const lawyerShare = quotedFee - platformFee;
      const total = quotedFee;
      const pct = commissionPctLabel();

      const isDemoUser = req.user.email === 'citizen@test.com' || isDemoEmail(req.user.email);
      const paymentsMode = isDemoUser ? 'simulated' : (isPaymongoMode() ? 'paymongo' : 'simulated');

      return res.json({
        merchant: env.PLATFORM_MERCHANT_NAME,
        type: 'booking',
        bookingId: booking.id,
        lawyerName: booking.lawyer.name,
        paymentsMode,
        commissionRate: env.PLATFORM_COMMISSION_RATE,
        preferredMethod: 'GCASH',
        holdNotice:
          'Your payment is safely held by Ordinex and will only be credited to the lawyer after your consultation is completed (verifying no reports or issues). In case a problem or cancellation occurs, your payment will be immediately refunded to you.',
        lineItems: [
          { label: `Consultation fee (${booking.lawyer.name})`, amount: quotedFee },
        ],
        total,
        currency: 'PHP',
      });
    }

    return res.status(400).json({ error: 'type must be "booking".' });
  } catch (error) {
    next(error);
  }
});

// ======================== CREATE PAYMONGO SESSION ========================
/**
 * POST /api/payments/create-session
 * Body: { bookingId }
 * Returns { checkoutUrl, sessionId } when PAYMENTS_MODE=paymongo.
 */
router.post('/create-session', requireAuth, async (req, res, next) => {
  try {
    if (!isPaymongoMode()) {
      return res.status(400).json({
        error: 'PayMongo checkout is not enabled. Use simulated confirm instead.',
        code: 'PAYMONGO_DISABLED',
      });
    }

    const { bookingId } = req.body || {};
    if (!bookingId) {
      return res.status(400).json({ error: 'bookingId is required.' });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { lawyer: { select: { name: true } } },
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.citizenId !== req.user.id) {
      return res.status(403).json({ error: 'You do not have access to this booking.' });
    }
    if (booking.status !== 'APPROVED') {
      return res.status(409).json({ error: 'Booking must be in APPROVED status to pay.' });
    }
    if (!booking.quotedFee || booking.quotedFee <= 0) {
      return res.status(409).json({ error: 'No quoted fee on this booking.' });
    }

    const frontend = (env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    const successUrl =
      `${frontend}/checkout?type=booking&bookingId=${encodeURIComponent(bookingId)}` +
      `&paymongo_session={CHECKOUT_SESSION_ID}`;
    const cancelUrl =
      `${frontend}/checkout?type=booking&bookingId=${encodeURIComponent(bookingId)}&cancelled=1`;

    const session = await createCheckoutSession({
      amountPhp: booking.quotedFee,
      description: `Consultation with ${booking.lawyer.name}`,
      lineItemName: `Legal consultation — ${booking.lawyer.name}`,
      successUrl,
      cancelUrl,
      metadata: {
        bookingId,
        userId: req.user.id,
      },
    });

    if (!session.checkoutUrl) {
      return res.status(502).json({ error: 'PayMongo did not return a checkout URL.' });
    }

    res.json({
      sessionId: session.id,
      checkoutUrl: session.checkoutUrl,
      preferredMethod: 'GCASH',
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status >= 400 && error.status < 600 ? error.status : 502).json({
        error: error.message,
      });
    }
    next(error);
  }
});

// ======================== COMPLETE PAYMONGO SESSION ========================
/**
 * POST /api/payments/complete-session
 * Body: { sessionId }
 * Called from success_url return (local-friendly without ngrok webhook).
 */
router.post('/complete-session', requireAuth, async (req, res, next) => {
  try {
    if (!isPaymongoMode()) {
      return res.status(400).json({ error: 'PayMongo mode is not enabled.' });
    }
    const { sessionId } = req.body || {};
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId is required.' });
    }

    const session = await retrieveCheckoutSession(sessionId);
    if (!session.paid) {
      return res.status(409).json({
        error: 'Payment is not completed yet. Finish GCash checkout, then return here.',
        code: 'PAYMENT_PENDING',
        status: session.status,
      });
    }

    const bookingId = session.metadata?.bookingId;
    const metaUserId = session.metadata?.userId;
    if (!bookingId) {
      return res.status(400).json({ error: 'Checkout session is missing booking metadata.' });
    }
    if (metaUserId && metaUserId !== req.user.id) {
      return res.status(403).json({ error: 'This payment session belongs to another account.' });
    }

    const firstPayment = session.payments?.[0];
    const providerPaymentId =
      firstPayment?.id ||
      firstPayment?.attributes?.id ||
      null;

    const result = await finalizeBookingPayment({
      bookingId,
      citizenId: req.user.id,
      citizenName: req.user.name,
      idempotencyKey: `paymongo:${sessionId}`,
      method: methodFromPaymongo(session.paymentMethodUsed),
      providerPaymentId,
    });

    res.json({
      message: result.alreadyProcessed
        ? 'Payment already processed.'
        : 'Payment confirmed. Booking is now CONFIRMED.',
      paymentId: result.paymentId,
      bookingId,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
});

// ======================== WEBHOOK ========================
/**
 * POST /api/payments/webhook/paymongo
 * Note: uses JSON body (signature optional when PAYMONGO_WEBHOOK_SECRET empty).
 */
router.post('/webhook/paymongo', async (req, res, next) => {
  try {
    const raw = JSON.stringify(req.body);
    const sig = req.headers['paymongo-signature'];
    if (!verifyPaymongoSignature(raw, sig, env.PAYMONGO_WEBHOOK_SECRET)) {
      return res.status(401).json({ error: 'Invalid PayMongo signature.' });
    }

    const eventType = req.body?.data?.attributes?.type || req.body?.type;
    const dataObj = req.body?.data?.attributes?.data || req.body?.data;

    // checkout_session.payment.paid
    if (String(eventType || '').includes('checkout_session.payment.paid') ||
        String(eventType || '').includes('payment.paid')) {
      const sessionId = dataObj?.id;
      const attrs = dataObj?.attributes || {};
      const metadata = attrs.metadata || {};
      const bookingId = metadata.bookingId;
      const userId = metadata.userId;
      if (sessionId && bookingId && userId) {
        await finalizeBookingPayment({
          bookingId,
          citizenId: userId,
          citizenName: 'Citizen',
          idempotencyKey: `paymongo:${sessionId}`,
          method: 'GCASH',
        }).catch(() => {});
      }
    }

    res.json({ received: true });
  } catch (error) {
    next(error);
  }
});

// ======================== CONFIRM PAYMENT (simulated) ========================
router.post('/confirm', requireAuth, async (req, res, next) => {
  try {
    const { idempotencyKey, type, bookingId, method } = req.body;

    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      return res.status(400).json({ error: 'idempotencyKey is required.' });
    }
    if (type === 'SUBSCRIPTION') {
      return res.status(410).json({
        error: 'Platform subscriptions are no longer offered.',
        code: 'SUBSCRIPTION_REMOVED',
      });
    }
    if (type !== 'BOOKING') {
      return res.status(400).json({ error: 'type must be BOOKING.' });
    }
    const isDemoUser = req.user.email === 'citizen@test.com' || isDemoEmail(req.user.email);
    if (isPaymongoMode() && !isDemoUser) {
      return res.status(400).json({
        error: 'Use PayMongo checkout (GCash) for this environment.',
        code: 'USE_PAYMONGO_CHECKOUT',
      });
    }
    if (!bookingId) {
      return res.status(400).json({ error: 'bookingId is required for booking payments.' });
    }

    const result = await finalizeBookingPayment({
      bookingId,
      citizenId: req.user.id,
      citizenName: req.user.name,
      idempotencyKey,
      method: method || 'SIMULATED',
    });

    res.json({
      message: result.alreadyProcessed
        ? 'Payment already processed.'
        : 'Payment confirmed. Booking is now CONFIRMED.',
      paymentId: result.paymentId,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
});

// ======================== WALLET ========================
router.get('/wallet', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'LAWYER') {
      return res.status(403).json({ error: 'Only lawyers have a wallet.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { walletBalance: true, walletPending: true },
    });

    const recentEarnings = await prisma.booking.findMany({
      where: {
        lawyerId: req.user.id,
        lawyerShare: { not: null },
      },
      select: {
        id: true,
        status: true,
        quotedFee: true,
        platformFee: true,
        lawyerShare: true,
        createdAt: true,
        citizen: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const payoutRequests = await prisma.payoutRequest.findMany({
      where: { lawyerId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    res.json({
      walletBalance: user?.walletBalance ?? 0,
      walletPending: user?.walletPending ?? 0,
      recentEarnings,
      payoutRequests,
    });
  } catch (error) {
    next(error);
  }
});

// ======================== PAYOUT REQUEST ========================
router.post('/payout-request', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'LAWYER') {
      return res.status(403).json({ error: 'Only lawyers can request payouts.' });
    }

    const { amount, method, accountDetails } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0.' });
    }
    if (!['GCASH', 'BANK'].includes(method)) {
      return res.status(400).json({ error: 'Method must be GCASH or BANK.' });
    }
    if (!accountDetails) {
      return res.status(400).json({ error: 'Account details are required.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { walletBalance: true },
    });

    if (!user || user.walletBalance < amount) {
      return res.status(400).json({
        error: `Insufficient balance. Available: ₱${(user?.walletBalance ?? 0).toLocaleString()}`,
      });
    }

    const payout = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: req.user.id },
        data: { walletBalance: { decrement: amount } },
      });

      return tx.payoutRequest.create({
        data: {
          lawyerId: req.user.id,
          amount,
          method,
          accountDetails: typeof accountDetails === 'string'
            ? accountDetails
            : JSON.stringify(accountDetails),
          status: 'PENDING',
        },
      });
    });

    res.status(201).json({
      message: 'Payout request submitted. You will be notified when it is processed.',
      payoutRequest: payout,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
