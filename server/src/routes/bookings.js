// ============================================================
// Ordinex - Bookings (Lifecycle + Persistent Chat)
// All booking state changes go through here. The state machine
// in services/bookingState.js validates every transition.
// ============================================================
import { Router } from 'express';
import crypto from 'crypto';
import { isDemoEmail } from '../../prisma/demoAccounts.js';
import { canJoinBookingVideo } from '../utils/bookingSlotWindow.js';
import { prisma } from '../config/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireCitizen, requireCitizenVerified, requireLawyerVerified } from '../middleware/premium.js';
import { STATUS, checkTransition, isChatOpen } from '../services/bookingState.js';
import {
  emitBookingChatMessage,
  emitBookingChanged,
  emitBookingChatClosed,
  emitBookingTranscriptSegment,
  emitAvailabilityChanged,
} from '../socket/bookingSocket.js';
import {
  parseTranscript,
  serializeTranscript,
  appendTranscriptSegment,
  patchTranscriptText,
} from '../services/transcriptStore.js';
import { createNotification } from '../services/notify.js';
import { anchorBookingRecord } from '../services/recordHash.js';
import { refundBookingPayment } from '../services/bookingPayments.js';
import { notifyLawyerBookingRequest } from '../services/smsNotify.js';
import { env } from '../config/env.js';
import { hasBookingCaseContext, bookingCaseContextError } from '../utils/bookingCaseContext.js';
import { lawyerFeeMin, lawyerFeeMax } from '../utils/lawyerFees.js';
import {
  LIVE_SESSION_STATUSES,
  holdEnd,
  sessionInterval,
  intervalsOverlap,
  validateSessionRange,
  normalizeHm,
} from '../utils/sessionOverlap.js';
import { recordingUpload, audioChunkUpload, persistUploadedFile } from '../services/uploads.js';
import { transcribeLiveAudio } from '../services/liveTranscribe.js';
import { daysRemainingInTrash, trashCutoffDate, TRASH_RETENTION_DAYS } from '../services/recycleBin.js';
import { normalizeLegacyAiResult } from '../services/legalValidator.js';

const router = Router();
const CASE_DESCRIPTION_FROM_ANALYSIS_MAX = 500;

// ======================== CREATE ========================
/**
 * POST /api/bookings
 * Body: { availabilityId, preferredStartTime, consultationId?, caseDescription? }
 *
 * Logged-in citizens only. Holds 60 minutes from the preferred start inside the duty window.
 */
router.post('/', requireAuth, requireCitizen, requireCitizenVerified, async (req, res, next) => {
  try {
    const { availabilityId, consultationId, caseDescription, preferredStartTime } = req.body;

    if (!availabilityId) return res.status(400).json({ error: 'availabilityId is required.' });
    if (!preferredStartTime) {
      return res.status(400).json({ error: 'Pick a start time inside the lawyer\'s open hours.' });
    }
    if (!hasBookingCaseContext({ consultationId, caseDescription })) {
      return res.status(400).json({ error: bookingCaseContextError() });
    }

    const slot = await prisma.availability.findUnique({
      where: { id: availabilityId },
      include: { lawyer: true },
    });
    if (!slot) return res.status(404).json({ error: 'Slot not found.' });
    if (slot.lawyer.isBanned) return res.status(403).json({ error: 'This lawyer is unavailable.' });
    if (slot.lawyer.acceptingBookings === false) {
      return res.status(403).json({ error: 'This lawyer is not accepting new bookings right now.' });
    }

    const sessionStartTime = normalizeHm(preferredStartTime);
    const sessionEndTime = holdEnd(sessionStartTime, slot.endTime);
    const rangeErr = validateSessionRange(sessionStartTime, sessionEndTime, slot.startTime, slot.endTime);
    if (rangeErr) return res.status(400).json({ error: rangeErr });

    let linkedConsultation = null;
    let resolvedCaseDescription = caseDescription?.trim() || null;

    if (consultationId) {
      linkedConsultation = await prisma.consultation.findUnique({ where: { id: consultationId } });
      if (!linkedConsultation || linkedConsultation.userId !== req.user.id) {
        return res.status(400).json({ error: 'Linked AI analysis not found.' });
      }
      if (!resolvedCaseDescription) {
        const summary = parseConsultationAiSummary(linkedConsultation.aiResult);
        if (summary) {
          resolvedCaseDescription = summary.slice(0, CASE_DESCRIPTION_FROM_ANALYSIS_MAX);
        }
      }
    }

    let booking;
    try {
      booking = await prisma.$transaction(async (tx) => {
        const overlap = await findSessionOverlap(tx, {
          lawyerId: slot.lawyerId,
          date: slot.date,
          start: sessionStartTime,
          end: sessionEndTime,
        });
        if (overlap) {
          const err = new Error('OVERLAP');
          err.code = 'OVERLAP';
          throw err;
        }

        return tx.booking.create({
          data: {
            citizenId: req.user.id,
            lawyerId: slot.lawyerId,
            availabilityId: slot.id,
            preferredStartTime: sessionStartTime,
            sessionStartTime,
            sessionEndTime,
            feeAtBooking: lawyerFeeMin(slot.lawyer),
            consultationId: consultationId || null,
            caseDescription: resolvedCaseDescription,
            status: STATUS.REQUESTED,
          },
          include: bookingInclude(),
        });
      });
    } catch (err) {
      if (err.code === 'OVERLAP') {
        return res.status(409).json({ error: 'That time is no longer available.' });
      }
      throw err;
    }

    createNotification({
      userId: slot.lawyerId,
      title: 'New booking request',
      message: `${req.user.name} requested ${sessionStartTime}–${sessionEndTime}.`,
      type: 'BOOKING_REQUESTED',
      linkTo: `/booking/${booking.id}`,
    }).catch(() => {});

    notifyLawyerBookingRequest(slot.lawyer, req.user.name).catch(() => {});
    emitAvailabilityChanged(slot.lawyerId);

    const consultationMap = linkedConsultation
      ? new Map([[linkedConsultation.id, linkedConsultation]])
      : new Map();
    res.status(201).json({ booking: publishBooking(booking, req.user.id, consultationMap) });
  } catch (error) {
    next(error);
  }
});

// ======================== LAWYER: APPROVE ========================
router.patch('/:id/approve', requireAuth, requireLawyerVerified, async (req, res, next) => {
  try {
    const booking = await loadOwnedBooking(req, 'lawyer');
    if (!booking.ok) return res.status(booking.status).json({ error: booking.error });

    const err = checkTransition(booking.data.status, STATUS.APPROVED, 'lawyer');
    if (err) return res.status(409).json({ error: err });

    const { quotedFee, paymentType, sessionStartTime, sessionEndTime } = req.body || {};

    const duty = booking.data.availability;
    const start = normalizeHm(sessionStartTime || booking.data.sessionStartTime || booking.data.preferredStartTime || duty.startTime);
    const end = normalizeHm(sessionEndTime || booking.data.sessionEndTime || '');
    if (!sessionStartTime || !sessionEndTime) {
      return res.status(400).json({ error: 'Set the exact session start and end times.' });
    }
    const rangeErr = validateSessionRange(start, end, duty.startTime, duty.endTime);
    if (rangeErr) return res.status(400).json({ error: rangeErr });

    const clash = await findSessionOverlap(prisma, {
      lawyerId: booking.data.lawyerId,
      date: duty.date,
      start,
      end,
      excludeBookingId: booking.data.id,
    });
    if (clash) {
      return res.status(409).json({ error: 'That time overlaps another booking.' });
    }

    // Determine if this is a free or paid booking
    const lawyerMin = lawyerFeeMin(booking.data.lawyer);
    const lawyerMax = lawyerFeeMax(booking.data.lawyer);
    const isFreeBooking = lawyerMin <= 0 && lawyerMax <= 0;

    let resolvedQuotedFee = 0;
    if (!isFreeBooking) {
      // quotedFee is required for paid bookings
      if (quotedFee == null || isNaN(Number(quotedFee)) || Number(quotedFee) <= 0) {
        return res.status(400).json({
          error: 'quotedFee is required for paid bookings.',
          code: 'QUOTED_FEE_REQUIRED',
        });
      }
      resolvedQuotedFee = Number(quotedFee);
      // Validate within min/max range
      if (resolvedQuotedFee < lawyerMin || resolvedQuotedFee > lawyerMax) {
        return res.status(400).json({
          error: `Quoted fee must be between ₱${lawyerMin.toLocaleString()} and ₱${lawyerMax.toLocaleString()}.`,
          code: 'QUOTED_FEE_OUT_OF_RANGE',
        });
      }
    }

    const nextStatus = isFreeBooking ? STATUS.CONFIRMED : STATUS.APPROVED;

    // Legacy: payment snapshot for old flow (optional, only if paymentType provided)
    let paymentSnapshot = null;
    if (!isFreeBooking && paymentType) {
      const methods = safeJsonParse(booking.data.lawyer.paymentMethods, []);
      if (methods.length) {
        const normType = (t) => {
          const x = (t || '').toLowerCase();
          if (x === 'bank') return 'bank';
          if (x === 'ewallet' || x === 'e-wallet') return 'ewallet';
          if (['gcash', 'maya', 'grabpay', 'paymaya'].includes(x)) return 'ewallet';
          return null;
        };
        const want = normType(paymentType);
        const chosen = methods.find((m) => normType(m.type) === want);
        if (chosen) paymentSnapshot = JSON.stringify(chosen);
      }
    }

    const platformFee = isFreeBooking ? 0 : Math.round(resolvedQuotedFee * env.PLATFORM_COMMISSION_RATE * 100) / 100;
    const lawyerShare = isFreeBooking ? 0 : resolvedQuotedFee - platformFee;

    const updated = await prisma.booking.update({
      where: { id: booking.data.id },
      data: {
        status: nextStatus,
        quotedFee: isFreeBooking ? null : resolvedQuotedFee,
        platformFee: isFreeBooking ? null : platformFee,
        lawyerShare: isFreeBooking ? null : lawyerShare,
        feeAtBooking: isFreeBooking ? 0 : resolvedQuotedFee,
        approvedAt: isFreeBooking ? null : new Date(),
        paymentSnapshot,
        roomId: isFreeBooking ? booking.data.roomId || crypto.randomUUID() : booking.data.roomId,
        sessionStartTime: start,
        sessionEndTime: end,
      },
      include: bookingInclude(),
    });

    const title = nextStatus === STATUS.CONFIRMED ? 'Booking confirmed' : 'Booking approved';
    const rangeLabel = `${start}–${end}`;
    const message = nextStatus === STATUS.CONFIRMED
      ? `Your booking is confirmed for ${rangeLabel}. Join from the booking page when it is time.`
      : `Your booking was approved for ${rangeLabel}. Total: ₱${resolvedQuotedFee.toLocaleString()}. Pay with GCash within 24 hours to confirm.`;
    createNotification({
      userId: booking.data.citizenId,
      title,
      message,
      type: 'BOOKING_STATUS',
      linkTo: `/booking/${updated.id}`,
    }).catch(() => {});

    emitAvailabilityChanged(booking.data.lawyerId);
    res.json({ booking: publishBooking(updated, req.user.id) });
  } catch (error) {
    next(error);
  }
});

// ======================== LAWYER: DECLINE ========================
router.patch('/:id/decline', requireAuth, requireLawyerVerified, async (req, res, next) => {
  try {
    const booking = await loadOwnedBooking(req, 'lawyer');
    if (!booking.ok) return res.status(booking.status).json({ error: booking.error });

    const err = checkTransition(booking.data.status, STATUS.DECLINED, 'lawyer');
    if (err) return res.status(409).json({ error: err });

    const [updated] = await prisma.$transaction([
      prisma.booking.update({
        where: { id: booking.data.id },
        data: { status: STATUS.DECLINED },
        include: bookingInclude(),
      }),
      // Free the availability slot so other citizens can grab it.
      prisma.availability.update({
        where: { id: booking.data.availabilityId },
        data: { isBooked: false, version: { increment: 1 } },
      }),
    ]);

    createNotification({
      userId: booking.data.citizenId,
      title: 'Booking declined',
      message: 'The lawyer declined your booking request.',
      type: 'BOOKING_DECLINED',
      linkTo: `/booking/${updated.id}`,
    }).catch(() => {});

    res.json({ booking: publishBooking(updated, req.user.id) });
  } catch (error) {
    next(error);
  }
});

// ======================== LAWYER: CONFIRM PAYMENT ========================
router.patch('/:id/confirm-payment', requireAuth, requireLawyerVerified, async (req, res, next) => {
  try {
    const booking = await loadOwnedBooking(req, 'lawyer');
    if (!booking.ok) return res.status(booking.status).json({ error: booking.error });

    const err = checkTransition(booking.data.status, STATUS.CONFIRMED, 'lawyer');
    if (err) return res.status(409).json({ error: err });

    const updated = await prisma.booking.update({
      where: { id: booking.data.id },
      data: {
        status: STATUS.CONFIRMED,
        paymentVerifiedAt: new Date(),
        roomId: booking.data.roomId || crypto.randomUUID(),
      },
      include: bookingInclude(),
    });

    createNotification({
      userId: booking.data.citizenId,
      title: 'Payment verified',
      message: 'Your payment was verified. The session is confirmed.',
      type: 'BOOKING_STATUS',
      linkTo: `/booking/${updated.id}`,
    }).catch(() => {});

    res.json({ booking: publishBooking(updated, req.user.id) });
  } catch (error) {
    next(error);
  }
});

// ======================== EITHER: PREFLIGHT CONSENT ========================
/**
 * POST /api/bookings/:id/consult-consent
 * Persists policy/device consent before video join.
 */
router.post('/:id/consult-consent', requireAuth, async (req, res, next) => {
  try {
    const booking = await loadOwnedBooking(req, 'either');
    if (!booking.ok) return res.status(booking.status).json({ error: booking.error });
    if (!['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'RATED'].includes(booking.data.status)) {
      return res.status(409).json({ error: 'Consultation is not ready for consent.' });
    }
    const updated = await prisma.booking.update({
      where: { id: booking.data.id },
      data: { consultConsentAt: new Date() },
      include: bookingInclude(),
    });
    res.json({ booking: publishBooking(updated, req.user.id), consentedAt: updated.consultConsentAt });
  } catch (error) {
    next(error);
  }
});

// ======================== EITHER: START SESSION ========================
/**
 * PATCH /api/bookings/:id/start-session
 * Citizen or lawyer marks the live session as started (CONFIRMED → IN_PROGRESS).
 * Idempotent when already IN_PROGRESS. Requires prior consult consent.
 */
router.patch('/:id/start-session', requireAuth, async (req, res, next) => {
  try {
    const booking = await loadOwnedBooking(req, 'either');
    if (!booking.ok) return res.status(booking.status).json({ error: booking.error });

    const actor = booking.data.citizenId === req.user.id ? 'citizen' : 'lawyer';

    if (booking.data.status === STATUS.IN_PROGRESS) {
      return res.json({ booking: publishBooking(booking.data, req.user.id) });
    }

    if (!booking.data.consultConsentAt) {
      return res.status(403).json({
        error: 'Complete the preflight consent checklist before joining the video session.',
        code: 'CONSENT_REQUIRED',
      });
    }

    const av = booking.data.availability;
    const demoBypass = isDemoEmail(req.user.email);
    const slotWindow = {
      date: av.date,
      startTime: booking.data.sessionStartTime || av.startTime,
      endTime: booking.data.sessionEndTime || av.endTime,
    };
    if (!canJoinBookingVideo(slotWindow, booking.data.status, new Date(), demoBypass)) {
      return res.status(403).json({
        error: 'Video consultation is only available during your scheduled booking time.',
        code: 'OUTSIDE_BOOKING_SLOT',
      });
    }

    const err = checkTransition(booking.data.status, STATUS.IN_PROGRESS, actor);
    if (err) return res.status(409).json({ error: err });

    const updated = await prisma.booking.update({
      where: { id: booking.data.id },
      data: {
        status: STATUS.IN_PROGRESS,
        roomId: booking.data.roomId || crypto.randomUUID(),
      },
      include: bookingInclude(),
    });
    res.json({ booking: publishBooking(updated, req.user.id) });
  } catch (error) {
    next(error);
  }
});

// ======================== LAWYER: CLOSE CASE (RELEASE HELD FUNDS) ========================
/**
 * PATCH /api/bookings/:id/complete
 * Lawyer only — closes the case and moves walletPending → walletBalance.
 */
router.patch('/:id/complete', requireAuth, async (req, res, next) => {
  try {
    const booking = await loadOwnedBooking(req, 'lawyer');
    if (!booking.ok) return res.status(booking.status).json({ error: booking.error });

    const err = checkTransition(booking.data.status, STATUS.COMPLETED, 'lawyer');
    if (err) return res.status(409).json({ error: err });

    const lawyerShareAmount = booking.data.lawyerShare || 0;
    const walletOps = lawyerShareAmount > 0
      ? [prisma.user.update({
          where: { id: booking.data.lawyerId },
          data: {
            walletPending: { decrement: lawyerShareAmount },
            walletBalance: { increment: lawyerShareAmount },
          },
        })]
      : [];

    const [updated] = await prisma.$transaction([
      prisma.booking.update({
        where: { id: booking.data.id },
        data: {
          status: STATUS.COMPLETED,
          chatClosedAt: new Date(Date.now() + 30 * 60 * 1000),
        },
        include: bookingInclude(),
      }),
      ...walletOps,
    ]);

    createNotification({
      userId: booking.data.citizenId,
      title: 'Consultation closed',
      message: 'Your lawyer closed the case. Held payment has been released to counsel. You can still chat briefly and leave a review.',
      type: 'BOOKING_STATUS',
      linkTo: `/booking/${booking.data.id}`,
    }).catch(() => {});

    createNotification({
      userId: booking.data.lawyerId,
      title: 'Earnings released',
      message: 'Case closed. Your share moved from held balance to withdrawable wallet.',
      type: 'BOOKING_STATUS',
      linkTo: `/booking/${booking.data.id}`,
    }).catch(() => {});

    anchorBookingRecord(updated).catch((err) =>
      console.warn('[recordHash] anchor failed:', err.message)
    );

    res.json({ booking: publishBooking(updated, req.user.id) });
  } catch (error) {
    next(error);
  }
});

// ======================== EITHER: CANCEL + REFUND (before / without completed session) ========================
/**
 * PATCH /api/bookings/:id/cancel-refund
 * Either party may cancel a paid/confirmed booking before completion → refund citizen.
 */
router.patch('/:id/cancel-refund', requireAuth, async (req, res, next) => {
  try {
    const booking = await loadOwnedBooking(req, 'either');
    if (!booking.ok) return res.status(booking.status).json({ error: booking.error });

    const actor = booking.data.citizenId === req.user.id ? 'citizen' : 'lawyer';
    const err = checkTransition(booking.data.status, STATUS.CANCELLED_REFUNDED, actor);
    if (err) return res.status(409).json({ error: err });

    if (['IN_PROGRESS'].includes(booking.data.status)) {
      return res.status(409).json({
        error: 'Cancel is not available after the live session has started. Use no-show or close case instead.',
      });
    }

    // Citizens may only cancel before the scheduled consultation day.
    if (actor === 'citizen' && booking.data.availability?.date) {
      const sessionDay = new Date(booking.data.availability.date);
      sessionDay.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (today >= sessionDay) {
        return res.status(409).json({
          error: 'Cancellation is only allowed before the day of your consultation. Contact the lawyer or use no-show if they do not appear.',
        });
      }
    }

    await refundBookingPayment(booking.data, {
      reason: 'requested_by_customer',
      actorLabel: actor === 'citizen' ? 'The client' : 'The lawyer',
    });

    const updated = await prisma.$transaction(async (tx) => {
      await tx.availability.update({
        where: { id: booking.data.availabilityId },
        data: { isBooked: false, version: { increment: 1 } },
      }).catch(() => null);
      return tx.booking.update({
        where: { id: booking.data.id },
        data: { status: STATUS.CANCELLED_REFUNDED },
        include: bookingInclude(),
      });
    });

    res.json({ booking: publishBooking(updated, req.user.id), refunded: true });
  } catch (error) {
    next(error);
  }
});

// ======================== EITHER: NO-SHOW ========================
router.patch('/:id/no-show', requireAuth, async (req, res, next) => {
  try {
    const booking = await loadOwnedBooking(req, 'either');
    if (!booking.ok) return res.status(booking.status).json({ error: booking.error });

    const actor = booking.data.citizenId === req.user.id ? 'citizen' : 'lawyer';
    const err = checkTransition(booking.data.status, STATUS.NO_SHOW, actor);
    if (err) return res.status(409).json({ error: err });

    const noShowParty = actor === 'citizen' ? 'LAWYER' : 'CITIZEN';

    // Full refund to citizen when consult never properly completed
    await refundBookingPayment(booking.data, {
      reason: 'requested_by_customer',
      actorLabel: 'No-show',
    });

    const tx = [
      prisma.booking.update({
        where: { id: booking.data.id },
        data: { status: STATUS.NO_SHOW, noShowParty },
        include: bookingInclude(),
      }),
    ];
    if (noShowParty === 'LAWYER') {
      const lawyer = await prisma.user.findUnique({
        where: { id: booking.data.lawyerId },
        select: { noShowStrikes: true },
      });
      const strikes = (lawyer?.noShowStrikes ?? 0) + 1;
      tx.push(prisma.user.update({
        where: { id: booking.data.lawyerId },
        data: {
          noShowStrikes: strikes,
          ...(strikes >= env.NO_SHOW_STRIKE_LIMIT ? { isBanned: true } : {}),
        },
      }));
    }
    const [updated] = await prisma.$transaction(tx);
    res.json({ booking: publishBooking(updated, req.user.id) });
  } catch (error) {
    next(error);
  }
});

// ======================== CITIZEN: REVIEW ========================
router.post('/:id/review', requireAuth, async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    const stars = parseInt(rating);
    if (!stars || stars < 1 || stars > 5) {
      return res.status(400).json({ error: 'Rating must be 1-5 stars.' });
    }

    const booking = await loadOwnedBooking(req, 'citizen');
    if (!booking.ok) return res.status(booking.status).json({ error: booking.error });

    const err = checkTransition(booking.data.status, STATUS.RATED, 'citizen');
    if (err) return res.status(409).json({ error: err });
    if (booking.data.review) {
      return res.status(409).json({ error: 'You already reviewed this consultation.' });
    }

    // Recompute lawyer rating: weighted running average.
    const lawyer = await prisma.user.findUnique({
      where: { id: booking.data.lawyerId },
      select: { rating: true, ratingCount: true },
    });
    const newCount = (lawyer.ratingCount || 0) + 1;
    const newRating = ((lawyer.rating || 0) * (lawyer.ratingCount || 0) + stars) / newCount;

    const [_, updated] = await prisma.$transaction([
      prisma.review.create({
        data: {
          bookingId: booking.data.id,
          citizenId: req.user.id,
          rating: stars,
          comment: comment?.trim() || null,
        },
      }),
      prisma.booking.update({
        where: { id: booking.data.id },
        data: { status: STATUS.RATED },
        include: bookingInclude(),
      }),
      prisma.user.update({
        where: { id: booking.data.lawyerId },
        data: { rating: newRating, ratingCount: newCount },
      }),
    ]);
    res.json({ booking: publishBooking(updated, req.user.id) });
  } catch (error) {
    next(error);
  }
});

// ======================== LIST ========================
/**
 * GET /api/bookings/my?status=&limit=&page=
 * Returns the caller's bookings (citizen sees their own, lawyer sees theirs).
 */
router.get('/my', requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const where = req.user.role === 'CITIZEN'
      ? { citizenId: req.user.id, citizenDeletedAt: null }
      : { lawyerId: req.user.id, lawyerDeletedAt: null };
    if (req.query.status) where.status = req.query.status;

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: bookingInclude(),
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ]);

    const consultationMap = await fetchConsultationMapForBookings(bookings);
    res.json({
      bookings: bookings.map((b) =>
        serializeBooking(b, req.user.id, consultationMap.get(b.consultationId)),
      ),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});

// ======================== HISTORY TRASH ========================
router.get('/trash', requireAuth, async (req, res, next) => {
  try {
    const cutoff = trashCutoffDate();
    const isCitizen = req.user.role === 'CITIZEN';
    const deletedField = isCitizen ? 'citizenDeletedAt' : 'lawyerDeletedAt';
    const ownerField = isCitizen ? 'citizenId' : 'lawyerId';

    const bookings = await prisma.booking.findMany({
      where: {
        [ownerField]: req.user.id,
        [deletedField]: { not: null, gte: cutoff },
      },
      include: bookingInclude(),
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    res.json({
      items: bookings.map((b) => ({
        booking: serializeBooking(b, req.user.id),
        deletedAt: b[deletedField],
        daysRemaining: daysRemainingInTrash(b[deletedField]),
      })),
      retentionDays: TRASH_RETENTION_DAYS,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/restore', requireAuth, async (req, res, next) => {
  try {
    const booking = await loadOwnedBooking(req, 'either');
    if (!booking.ok) return res.status(booking.status).json({ error: booking.error });
    const b = booking.data;
    const isCitizen = req.user.role === 'CITIZEN';
    const deletedAt = isCitizen ? b.citizenDeletedAt : b.lawyerDeletedAt;
    if (!deletedAt) return res.json({ message: 'Already active.' });
    if (deletedAt < trashCutoffDate()) {
      return res.status(410).json({ error: 'This item can no longer be restored.' });
    }
    await prisma.booking.update({
      where: { id: b.id },
      data: isCitizen ? { citizenDeletedAt: null } : { lawyerDeletedAt: null },
    });
    res.json({ message: 'Consultation restored.' });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/history', requireAuth, async (req, res, next) => {
  try {
    const booking = await loadOwnedBooking(req, 'either');
    if (!booking.ok) return res.status(booking.status).json({ error: booking.error });
    const isCitizen = req.user.role === 'CITIZEN';
    await prisma.booking.update({
      where: { id: booking.data.id },
      data: isCitizen
        ? { citizenDeletedAt: new Date() }
        : { lawyerDeletedAt: new Date() },
    });
    res.json({
      message: 'Moved to Recycle Bin.',
      retentionDays: TRASH_RETENTION_DAYS,
    });
  } catch (error) {
    next(error);
  }
});

// ======================== LINKED AI ANALYSIS ========================
/**
 * GET /api/bookings/:id/linked-analysis
 * Citizen or lawyer on this booking may read the linked consultation analysis.
 */
router.get('/:id/linked-analysis', requireAuth, async (req, res, next) => {
  try {
    const booking = await loadOwnedBooking(req, 'either');
    if (!booking.ok) return res.status(booking.status).json({ error: booking.error });
    const b = booking.data;
    if (!b.consultationId) {
      return res.status(404).json({ error: 'No linked AI analysis on this booking.' });
    }
    const c = await prisma.consultation.findUnique({ where: { id: b.consultationId } });
    if (!c || c.deletedAt || c.userId !== b.citizenId) {
      return res.status(404).json({ error: 'Linked AI analysis not found.' });
    }
    res.json({ analysis: serializeLinkedAnalysisForBooking(c) });
  } catch (error) {
    next(error);
  }
});

// ======================== SINGLE ========================
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const booking = await loadOwnedBooking(req, 'either');
    if (!booking.ok) return res.status(booking.status).json({ error: booking.error });
    const b = booking.data;
    let consultation = null;
    if (b.consultationId) {
      consultation = await prisma.consultation.findUnique({
        where: { id: b.consultationId, deletedAt: null },
      });
    }
    res.json({
      booking: serializeBooking(b, req.user.id, consultation),
    });
  } catch (error) {
    next(error);
  }
});

// ======================== CHAT ========================
/**
 * GET /api/bookings/:id/chat
 * Returns the persistent chat history for this booking.
 */
router.get('/:id/chat', requireAuth, async (req, res, next) => {
  try {
    const booking = await loadOwnedBooking(req, 'either');
    if (!booking.ok) return res.status(booking.status).json({ error: booking.error });
    const msgs = booking.data.chatMessages
      ? safeJsonParse(booking.data.chatMessages, [])
      : [];
    res.json({
      messages: msgs,
      isOpen: isChatOpen(booking.data),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/bookings/:id/chat
 * Body: { content }
 * Append a new chat message. Rejects after the 30-min grace window.
 */
router.post('/:id/chat', requireAuth, async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content || content.trim().length < 1) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }
    if (content.length > 2000) {
      return res.status(400).json({ error: 'Message too long (max 2000 chars).' });
    }
    const booking = await loadOwnedBooking(req, 'either');
    if (!booking.ok) return res.status(booking.status).json({ error: booking.error });
    if (!isChatOpen(booking.data)) {
      return res.status(409).json({ error: 'Chat is closed for this booking.' });
    }

    const msgs = booking.data.chatMessages ? safeJsonParse(booking.data.chatMessages, []) : [];
    const newMsg = {
      id: crypto.randomUUID(),
      from: req.user.role === 'CITIZEN' ? 'citizen' : 'lawyer',
      fromUserId: req.user.id,
      content: content.trim(),
      sentAt: new Date().toISOString(),
    };
    msgs.push(newMsg);

    await prisma.booking.update({
      where: { id: booking.data.id },
      data: { chatMessages: JSON.stringify(msgs) },
    });
    emitBookingChatMessage(booking.data.id, newMsg);
    res.status(201).json({ message: newMsg });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/bookings/:id/close-chat
 * Lawyer only — closes chat immediately (anti-abuse).
 */
router.patch('/:id/close-chat', requireAuth, async (req, res, next) => {
  try {
    const booking = await loadOwnedBooking(req, 'lawyer');
    if (!booking.ok) return res.status(booking.status).json({ error: booking.error });

    if (![STATUS.IN_PROGRESS, STATUS.COMPLETED].includes(booking.data.status)) {
      return res.status(409).json({
        error: 'Chat can only be closed during or after an active consultation.',
      });
    }

    const updated = await prisma.booking.update({
      where: { id: booking.data.id },
      data: { chatClosedAt: new Date() },
      include: bookingInclude(),
    });

    emitBookingChatClosed(booking.data.id);
    res.json({ booking: publishBooking(updated, req.user.id) });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/bookings/:id/transcript
 */
router.get('/:id/transcript', requireAuth, async (req, res, next) => {
  try {
    const booking = await loadOwnedBooking(req, 'either');
    if (!booking.ok) return res.status(booking.status).json({ error: booking.error });
    const doc = parseTranscript(booking.data.transcript);
    res.json({
      plainText: doc.plainText,
      segments: doc.segments,
      editedAt: doc.editedAt,
      editedBy: doc.editedBy,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/bookings/:id/transcript/segment — live STT append (IN_PROGRESS only)
 */
router.post('/:id/transcript/segment', requireAuth, async (req, res, next) => {
  try {
    const booking = await loadOwnedBooking(req, 'either');
    if (!booking.ok) return res.status(booking.status).json({ error: booking.error });

    if (booking.data.status !== STATUS.IN_PROGRESS) {
      return res.status(409).json({ error: 'Live transcript is only available during an active session.' });
    }

    const { doc, segment } = appendTranscriptSegment(booking.data, req.body, req.user.id);
    await prisma.booking.update({
      where: { id: booking.data.id },
      data: { transcript: serializeTranscript(doc) },
    });

    emitBookingTranscriptSegment(booking.data.id, segment);
    res.status(201).json({ segment, plainText: doc.plainText });
  } catch (error) {
    if (error.message?.includes('required')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

/**
 * POST /api/bookings/:id/transcript/audio — live STT via Groq Whisper (IN_PROGRESS only)
 * Accepts a short audio clip captured during the session, transcribes it to
 * text in the SAME spoken language, then appends it as a transcript segment.
 * Falls back to Gemini transcription if Whisper is unavailable.
 */
router.post('/:id/transcript/audio', requireAuth, audioChunkUpload.single('audio'), async (req, res, next) => {
  try {
    const booking = await loadOwnedBooking(req, 'either');
    if (!booking.ok) return res.status(booking.status).json({ error: booking.error });

    if (booking.data.status !== STATUS.IN_PROGRESS) {
      return res.status(409).json({ error: 'Live transcript is only available during an active session.' });
    }
    if (!req.file?.buffer?.length) {
      return res.status(400).json({ error: 'No audio chunk uploaded.' });
    }

    const { text, lang, provider } = await transcribeLiveAudio({
      audioBuffer: req.file.buffer,
      mimeType: req.file.mimetype || 'audio/webm',
      filename: req.file.originalname || 'chunk.webm',
      langHint: req.body?.lang,
    });

    if (!text) {
      return res.json({ segment: null, plainText: parseTranscript(booking.data.transcript).plainText, provider });
    }

    const { doc, segment } = appendTranscriptSegment(
      booking.data,
      { text, lang, isFinal: true },
      req.user.id,
    );
    await prisma.booking.update({
      where: { id: booking.data.id },
      data: { transcript: serializeTranscript(doc) },
    });

    emitBookingTranscriptSegment(booking.data.id, segment);
    res.status(201).json({ segment, plainText: doc.plainText, provider });
  } catch (error) {
    if (error.message?.includes('required')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

/**
 * PATCH /api/bookings/:id/transcript — edit plain text after session
 */
router.patch('/:id/transcript', requireAuth, async (req, res, next) => {
  try {
    const { plainText } = req.body;
    if (typeof plainText !== 'string') {
      return res.status(400).json({ error: 'plainText is required.' });
    }

    const booking = await loadOwnedBooking(req, 'either');
    if (!booking.ok) return res.status(booking.status).json({ error: booking.error });

    if (![STATUS.IN_PROGRESS, STATUS.COMPLETED, STATUS.RATED].includes(booking.data.status)) {
      return res.status(409).json({ error: 'Transcript cannot be edited in this booking state.' });
    }

    const doc = patchTranscriptText(booking.data, plainText, req.user.id);
    await prisma.booking.update({
      where: { id: booking.data.id },
      data: { transcript: serializeTranscript(doc) },
    });

    res.json({
      plainText: doc.plainText,
      segments: doc.segments,
      editedAt: doc.editedAt,
      editedBy: doc.editedBy,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/bookings/:id/recording — upload consultation recording
 * Accepts video/audio files up to 50 MB. Overwrites any previous recording.
 */
router.post('/:id/recording', requireAuth, recordingUpload.single('recording'), async (req, res, next) => {
  try {
    const booking = await loadOwnedBooking(req, 'either');
    if (!booking.ok) return res.status(booking.status).json({ error: booking.error });

    if (!['IN_PROGRESS', 'COMPLETED', 'RATED'].includes(booking.data.status)) {
      return res.status(409).json({ error: 'Recording can only be uploaded during or after a session.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No recording file uploaded.' });
    }

    const url = await persistUploadedFile(req.file, 'recordings');

    await prisma.booking.update({
      where: { id: booking.data.id },
      data: { recordingUrl: url },
    });

    // Return auth-gated download path (not raw public /uploads)
    res.json({ recordingUrl: `/api/bookings/${booking.data.id}/recording` });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/bookings/:id/recording — authenticated download of recording file
 */
router.get('/:id/recording', requireAuth, async (req, res, next) => {
  try {
    const booking = await loadOwnedBooking(req, 'either');
    if (!booking.ok) return res.status(booking.status).json({ error: booking.error });
    const url = booking.data.recordingUrl;
    if (!url) return res.status(404).json({ error: 'No recording available.' });

    // Local uploads path → stream; remote (Supabase) → redirect
    if (url.startsWith('/uploads/') || url.startsWith('uploads/')) {
      const pathMod = await import('path');
      const fs = await import('fs');
      const rel = url.replace(/^\//, '');
      const abs = pathMod.resolve(process.cwd(), rel);
      if (!fs.existsSync(abs)) return res.status(404).json({ error: 'Recording file missing.' });
      res.setHeader('Content-Type', 'video/webm');
      res.setHeader('Content-Disposition', `attachment; filename="consultation-${booking.data.id.slice(0, 8)}.webm"`);
      return fs.createReadStream(abs).pipe(res);
    }
    return res.redirect(url);
  } catch (error) {
    next(error);
  }
});

// ────── helpers ──────

/**
 * Default Prisma `include` shape for a booking - parent relations + linked
 * objects the UI needs without making N+1 calls.
 */
function bookingInclude() {
  return {
    citizen: {
      select: {
        id: true, name: true, avatarUrl: true, phone: true,
        bio: true, isPremium: true, createdAt: true,
        dob: true, gender: true, address: true,
        civilStatus: true, occupation: true,
      },
    },
    lawyer: {
      select: {
        id: true, name: true, avatarUrl: true,
        specializations: true, practiceType: true, paymentMethods: true,
        consultationFee: true, rating: true, ratingCount: true,
      },
    },
    availability: { select: { date: true, startTime: true, endTime: true } },
    review: true,
  };
}

/**
 * Strip raw JSON-string columns into parsed shapes for the client.
 */
function parseConsultationAiSummary(aiResultRaw) {
  if (!aiResultRaw) return '';
  try {
    const ar = normalizeLegacyAiResult(JSON.parse(aiResultRaw));
    return (ar.userConcernSummary || '').trim();
  } catch {
    return '';
  }
}

function linkedAnalysisPreviewFromConsultation(c) {
  if (!c || c.deletedAt) return null;
  const summary = parseConsultationAiSummary(c.aiResult);
  return {
    title: c.title ?? null,
    category: c.category,
    userConcernSummary: summary.slice(0, 280),
  };
}

async function fetchConsultationMapForBookings(bookings) {
  const ids = [...new Set(bookings.map((b) => b.consultationId).filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = await prisma.consultation.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: {
      id: true,
      title: true,
      category: true,
      aiResult: true,
      deletedAt: true,
    },
  });
  return new Map(rows.map((r) => [r.id, r]));
}

function serializeLinkedAnalysisForBooking(c) {
  let aiResult = c.aiResult;
  try {
    aiResult = normalizeLegacyAiResult(JSON.parse(c.aiResult));
  } catch {
    // keep raw if unparseable
  }
  let analysisMeta = null;
  if (c.analysisMeta) {
    try {
      analysisMeta = JSON.parse(c.analysisMeta);
    } catch {
      analysisMeta = null;
    }
  }
  return {
    id: c.id,
    title: c.title,
    category: c.category,
    description: c.description,
    fileUrl: c.fileUrl || null,
    aiResult,
    analysisMeta,
    createdAt: c.createdAt,
  };
}

function overlaySessionOnAvailability(b) {
  const av = b.availability;
  if (!av) return av;
  const interval = sessionInterval(b, av.startTime, av.endTime);
  return { ...av, startTime: interval.start, endTime: interval.end };
}

async function findSessionOverlap(db, { lawyerId, date, start, end, excludeBookingId }) {
  const live = await db.booking.findMany({
    where: {
      lawyerId,
      status: { in: LIVE_SESSION_STATUSES },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      availability: { date },
    },
    select: {
      id: true,
      preferredStartTime: true,
      sessionStartTime: true,
      sessionEndTime: true,
      availability: { select: { startTime: true, endTime: true } },
    },
  });
  return live.find((b) => {
    const other = sessionInterval(b, b.availability.startTime, b.availability.endTime);
    return intervalsOverlap(start, end, other.start, other.end);
  }) || null;
}

function serializeBooking(b, viewerId, consultationOrPreview = null) {
  const linkedAnalysisPreview = consultationOrPreview
    ? linkedAnalysisPreviewFromConsultation(consultationOrPreview)
    : null;

  return {
    id: b.id,
    status: b.status,
    feeAtBooking: b.feeAtBooking,
    quotedFee: b.quotedFee ?? null,
    platformFee: b.platformFee ?? null,
    lawyerShare: b.lawyerShare ?? null,
    approvedAt: b.approvedAt ?? null,
    paymentReference: b.paymentReference,
    paymentReceiptUrl: b.paymentReceiptUrl,
    paymentSnapshot: safeJsonParse(b.paymentSnapshot, null),
    paymentVerifiedAt: b.paymentVerifiedAt,
    roomId: b.roomId,
    chatClosedAt: b.chatClosedAt,
    consultationId: b.consultationId,
    caseDescription: b.caseDescription,
    recordingUrl: b.recordingUrl
      ? `/api/bookings/${b.id}/recording`
      : null,
    linkedAnalysisPreview,
    noShowParty: b.noShowParty,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    chatIsOpen: isChatOpen(b),
    hasTranscript: Boolean(parseTranscript(b.transcript).plainText?.trim()),
    viewerRole: viewerId === b.citizenId ? 'CITIZEN' : 'LAWYER',
    citizen: b.citizen,
    lawyer: {
      ...b.lawyer,
      specializations: safeJsonParse(b.lawyer.specializations, []),
      paymentMethods: safeJsonParse(b.lawyer.paymentMethods, []),
    },
    availability: overlaySessionOnAvailability(b),
    preferredStartTime: b.preferredStartTime || null,
    sessionStartTime: b.sessionStartTime || null,
    sessionEndTime: b.sessionEndTime || null,
    dutyWindow: b.availability
      ? { startTime: b.availability.startTime, endTime: b.availability.endTime }
      : null,
    review: b.review || null,
  };
}

function publishBooking(booking, viewerId, consultationMap = new Map()) {
  const consultation = booking.consultationId
    ? consultationMap.get(booking.consultationId) ?? null
    : null;
  const serialized = serializeBooking(booking, viewerId, consultation);
  emitBookingChanged(booking.id, booking.citizenId, booking.lawyerId);
  return serialized;
}

function safeJsonParse(s, fallback) {
  if (!s) return fallback;
  try {
    const v = JSON.parse(s);
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

/**
 * Load a booking and verify the caller owns it (as the expected role).
 * `expectedRole`: 'citizen' | 'lawyer' | 'either'.
 *
 * Returns { ok: true, data } or { ok: false, status, error }.
 */
async function loadOwnedBooking(req, expectedRole) {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.id },
    include: bookingInclude(),
  });
  if (!booking) return { ok: false, status: 404, error: 'Booking not found.' };

  const isCitizen = booking.citizenId === req.user.id;
  const isLawyer = booking.lawyerId === req.user.id;

  if (!isCitizen && !isLawyer) {
    return { ok: false, status: 403, error: 'You do not have access to this booking.' };
  }
  if (expectedRole === 'citizen' && !isCitizen) {
    return { ok: false, status: 403, error: 'Only the citizen can perform this action.' };
  }
  if (expectedRole === 'lawyer' && !isLawyer) {
    return { ok: false, status: 403, error: 'Only the lawyer can perform this action.' };
  }

  if (isCitizen && booking.citizenDeletedAt) {
    return { ok: false, status: 404, error: 'Booking not found.' };
  }
  if (isLawyer && booking.lawyerDeletedAt) {
    return { ok: false, status: 404, error: 'Booking not found.' };
  }
  return { ok: true, data: booking };
}

export default router;
