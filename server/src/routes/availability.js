// ============================================================
// Ordinex - Lawyer Availability (CRUD)
// Lawyer-only endpoints for managing their bookable time slots.
// ============================================================
import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireLawyer, requireLawyerVerified } from '../middleware/premium.js';
import { emitAvailabilityChanged } from '../socket/bookingSocket.js';

const router = Router();

// HH:MM 24-hour format, e.g. 09:30, 17:00
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Body: { date: "YYYY-MM-DD", startTime: "HH:MM", endTime: "HH:MM" }
 * OR    { slots: [{date,startTime,endTime}, ...] }  (batch)
 *
 * Rejects:
 *   - past dates
 *   - end <= start
 *   - any slot that overlaps an existing slot for this lawyer/date
 */
router.post('/', requireAuth, requireLawyer, requireLawyerVerified, async (req, res, next) => {
  try {
    const incoming = Array.isArray(req.body.slots)
      ? req.body.slots
      : [{ date: req.body.date, startTime: req.body.startTime, endTime: req.body.endTime }];

    const normalized = [];
    for (const raw of incoming) {
      const err = validateSlot(raw);
      if (err) return res.status(400).json({ error: err });
      normalized.push({
        lawyerId: req.user.id,
        date: new Date(`${raw.date}T00:00:00.000Z`),
        startTime: raw.startTime,
        endTime: raw.endTime,
      });
    }

    // Overlap check against existing slots for the same lawyer + date.
    const dates = [...new Set(normalized.map((s) => s.date.toISOString()))];
    const existing = await prisma.availability.findMany({
      where: {
        lawyerId: req.user.id,
        date: { in: dates.map((d) => new Date(d)) },
      },
      select: { date: true, startTime: true, endTime: true },
    });

    for (const s of normalized) {
      const sameDay = existing.filter((e) => e.date.getTime() === s.date.getTime());
      if (sameDay.some((e) => overlaps(e.startTime, e.endTime, s.startTime, s.endTime))) {
        return res.status(409).json({
          error: `Slot ${s.startTime}-${s.endTime} on ${s.date.toISOString().slice(0, 10)} overlaps an existing slot.`,
        });
      }
      // Also check against the other slots in this same batch.
      const others = normalized.filter((o) => o !== s && o.date.getTime() === s.date.getTime());
      if (others.some((o) => overlaps(o.startTime, o.endTime, s.startTime, s.endTime))) {
        return res.status(400).json({
          error: `Slots in your request overlap each other on ${s.date.toISOString().slice(0, 10)}.`,
        });
      }
    }

    const created = await prisma.$transaction(
      normalized.map((s) => prisma.availability.create({ data: s }))
    );

    emitAvailabilityChanged(req.user.id);

    res.status(201).json({
      message: `${created.length} slot(s) created.`,
      slots: created.map((s) => ({
        id: s.id,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        isBooked: s.isBooked,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/availability/remove-many
 * Body: { all: true } or { from: "YYYY-MM-DD", to: "YYYY-MM-DD" }
 * Skips windows that already have bookings.
 */
router.post('/remove-many', requireAuth, requireLawyer, requireLawyerVerified, async (req, res, next) => {
  try {
    const all = Boolean(req.body.all);
    const fromStr = req.body.from ? String(req.body.from).slice(0, 10) : '';
    const toStr = req.body.to ? String(req.body.to).slice(0, 10) : '';
    if (!all && (!/^\d{4}-\d{2}-\d{2}$/.test(fromStr) || !/^\d{4}-\d{2}-\d{2}$/.test(toStr))) {
      return res.status(400).json({ error: 'Choose a start and end date, or remove all unused hours.' });
    }
    if (!all && fromStr > toStr) {
      return res.status(400).json({ error: 'End date must be on or after start date.' });
    }

    const where = {
      lawyerId: req.user.id,
      ...(!all
        ? {
            date: {
              gte: new Date(`${fromStr}T00:00:00.000Z`),
              lte: new Date(`${toStr}T00:00:00.000Z`),
            },
          }
        : {}),
    };

    const slots = await prisma.availability.findMany({
      where,
      include: { bookings: { select: { id: true } } },
    });
    const removable = slots.filter((s) => !(s.bookings || []).length);
    const skipped = slots.length - removable.length;
    if (removable.length) {
      await prisma.availability.deleteMany({
        where: { id: { in: removable.map((s) => s.id) } },
      });
      emitAvailabilityChanged(req.user.id);
    }
    res.json({ removed: removable.length, skipped });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/availability/:id
 * Allowed when no bookings exist on this duty window.
 */
router.delete('/:id', requireAuth, requireLawyer, requireLawyerVerified, async (req, res, next) => {
  try {
    const slot = await prisma.availability.findUnique({
      where: { id: req.params.id },
      include: {
        bookings: {
          include: { review: true, recordHash: true },
        },
      },
    });
    if (!slot) return res.status(404).json({ error: 'Slot not found.' });
    if (slot.lawyerId !== req.user.id) {
      return res.status(403).json({ error: 'You do not own this slot.' });
    }

    if ((slot.bookings || []).length > 0) {
      return res.status(409).json({
        error: 'These hours already have bookings and cannot be removed.',
      });
    }

    await prisma.availability.delete({ where: { id: slot.id } });

    emitAvailabilityChanged(req.user.id);

    res.json({ message: 'Slot deleted.' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/availability/my?from=&to=
 * Lawyer's own schedule (booked + open) for a date range.
 */
router.get('/my', requireAuth, requireLawyer, async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const from = req.query.from ? new Date(req.query.from) : today;
    const to = req.query.to ? new Date(req.query.to) : new Date(today.getTime() + 60 * 86400 * 1000);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return res.status(400).json({ error: 'Invalid date range.' });
    }

    const slots = await prisma.availability.findMany({
      where: { lawyerId: req.user.id, date: { gte: from, lte: to } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
    res.json({ slots });
  } catch (error) {
    next(error);
  }
});

// ────── helpers ──────

function validateSlot(s) {
  if (!s || !s.date || !s.startTime || !s.endTime) {
    return 'Each slot needs date, startTime and endTime.';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) {
    return 'date must be in YYYY-MM-DD format.';
  }
  if (!TIME_RE.test(s.startTime) || !TIME_RE.test(s.endTime)) {
    return 'startTime and endTime must be in HH:MM 24-hour format.';
  }
  if (s.endTime <= s.startTime) {
    return `endTime (${s.endTime}) must be after startTime (${s.startTime}).`;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Compare calendar dates (YYYY-MM-DD), not UTC instants — allows "today" in local TZ.
  const todayStr = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  if (s.date < todayStr) {
    return `Cannot create a slot in the past (${s.date}).`;
  }
  return null;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

export default router;
