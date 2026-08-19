// ============================================================
// Ordinex - Lawyers (Public Directory)
// Citizen-facing endpoints to discover, view, and check the
// availability of lawyers. No auth required to browse, but
// premium-gated routes still apply downstream (booking, etc.).
// ============================================================
import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireCitizen, requireCitizenVerified } from '../middleware/premium.js';
import { lawyerFeeMin, lawyerFeeMax } from '../utils/lawyerFees.js';
import {
  LIVE_SESSION_STATUSES,
  preferredStartsInWindow,
  sessionInterval,
} from '../utils/sessionOverlap.js';

const router = Router();

// Maximum lawyers per page; protect against `?limit=10000`
const MAX_PAGE_SIZE = 50;

/**
 * GET /api/lawyers?search=&specialty=&practiceType=&page=&limit=
 * Public directory list. Each row includes a hasAvailability
 * flag computed from the Availability table so the UI can grey
 * out lawyers with no open slots.
 */
router.get('/', requireAuth, requireCitizen, requireCitizenVerified, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(req.query.limit) || 12));
    const skip = (page - 1) * limit;

    const search = (req.query.search || '').trim();
    const practiceType = req.query.practiceType;
    const specialty = (req.query.specialty || '').trim();

    const where = {
      role: 'LAWYER',
      isBanned: false,
      isVerified: true,
      lawyerVerificationStatus: 'VERIFIED',
      acceptingBookings: { not: false },
      // Marketplace is private lawyers only
      practiceType: practiceType === 'PUBLIC' || practiceType === 'PRIVATE' ? practiceType : 'PRIVATE',
    };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { bio: { contains: search } },
        { specializations: { contains: search } },
      ];
    }
    // SQLite has no JSON ops, but specializations is a JSON-stringified
    // array of strings, so a substring match works fine for a single tag.
    if (specialty) {
      where.specializations = { contains: specialty };
    }

    // Over-fetch then soft-rank + standing filter (ACTIVE roll when known).
    const fetchTake = Math.min(200, Math.max(limit * 4, 48));
    const [candidates, totalRaw] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
        take: fetchTake,
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          bio: true,
          specializations: true,
          consultationFee: true,
          consultationFeeMin: true,
          consultationFeeMax: true,
          practiceType: true,
          yearsOfExperience: true,
          isVerified: true,
          rating: true,
          ratingCount: true,
          city: true,
          province: true,
          lawyerVerification: { select: { submittedRollNumber: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rollNumbers = [
      ...new Set(
        candidates
          .map((l) => l.lawyerVerification?.submittedRollNumber)
          .filter(Boolean),
      ),
    ];
    const rolls = rollNumbers.length
      ? await prisma.rollOfAttorneys.findMany({
          where: { rollNumber: { in: rollNumbers } },
          select: { rollNumber: true, status: true },
        })
      : [];
    const rollStatus = Object.fromEntries(rolls.map((r) => [r.rollNumber, r.status]));

    const standingOk = candidates.filter((l) => {
      const roll = l.lawyerVerification?.submittedRollNumber;
      if (!roll) return true; // admin-verified without roll still listable
      const status = rollStatus[roll];
      if (!status) return true;
      return status === 'ACTIVE';
    });

    const ids = standingOk.map((l) => l.id);
    const slotCounts = ids.length
      ? await prisma.availability.groupBy({
          by: ['lawyerId'],
          where: { lawyerId: { in: ids }, isBooked: false, date: { gte: today } },
          _count: { _all: true },
        })
      : [];
    const slotMap = Object.fromEntries(slotCounts.map((s) => [s.lawyerId, s._count._all]));

    const specialtyNeedle = specialty.toLowerCase();
    const enriched = standingOk
      .map((l) => {
        const specs = parseJsonArray(l.specializations);
        const openSlots = slotMap[l.id] || 0;
        const feeMin = lawyerFeeMin(l);
        const feeMax = lawyerFeeMax(l);
        const specialtyHit = specialtyNeedle
          ? specs.some((s) => {
              const hay = String(s).toLowerCase();
              return hay === specialtyNeedle || hay.includes(specialtyNeedle) || specialtyNeedle.includes(hay);
            })
          : false;
        return {
          id: l.id,
          name: l.name,
          avatarUrl: l.avatarUrl,
          bio: l.bio,
          specializations: specs,
          consultationFeeMin: feeMin,
          consultationFeeMax: feeMax,
          consultationFee: feeMin,
          practiceType: l.practiceType,
          yearsOfExperience: l.yearsOfExperience,
          isVerified: l.isVerified,
          rating: l.rating,
          ratingCount: l.ratingCount,
          city: l.city || null,
          province: l.province || null,
          openSlots,
          hasAvailability: openSlots > 0,
          _specialtyHit: specialtyHit,
        };
      })
      .sort((a, b) => {
        if (specialtyNeedle && Number(b._specialtyHit) !== Number(a._specialtyHit)) {
          return Number(b._specialtyHit) - Number(a._specialtyHit);
        }
        if (Number(b.hasAvailability) !== Number(a.hasAvailability)) {
          return Number(b.hasAvailability) - Number(a.hasAvailability);
        }
        if (b.openSlots !== a.openSlots) return b.openSlots - a.openSlots;
        if (b.rating !== a.rating) return b.rating - a.rating;
        if (b.ratingCount !== a.ratingCount) return b.ratingCount - a.ratingCount;
        const aFee = a.consultationFeeMin ?? Number.POSITIVE_INFINITY;
        const bFee = b.consultationFeeMin ?? Number.POSITIVE_INFINITY;
        return aFee - bFee;
      })
      .map(({ _specialtyHit, ...rest }) => rest);

    const pageSlice = enriched.slice(skip, skip + limit);

    res.json({
      lawyers: pageSlice,
      pagination: { page, limit, total: totalRaw, totalPages: Math.ceil(totalRaw / limit) },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/lawyers/:id
 * Full public profile. Includes credentials (without raw file urls
 * stripped, since dev mode serves them statically) and the most recent
 * 5 reviews so the UI can show a "What clients say" section.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const lawyer = await prisma.user.findFirst({
      where: {
        id: req.params.id,
        role: 'LAWYER',
        isBanned: false,
        isVerified: true,
        lawyerVerificationStatus: 'VERIFIED',
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        bio: true,
        barNumber: true,
        specializations: true,
        consultationFee: true,
        consultationFeeMin: true,
        consultationFeeMax: true,
        yearsOfExperience: true,
        practiceType: true,
        isVerified: true,
        paymentMethods: true,
        credentials: true,
        rating: true,
        ratingCount: true,
        createdAt: true,
        lawyerVerification: { select: { submittedRollNumber: true } },
      },
    });

    if (!lawyer) return res.status(404).json({ error: 'Lawyer not found.' });

    const rollNo = lawyer.lawyerVerification?.submittedRollNumber;
    if (rollNo) {
      const roll = await prisma.rollOfAttorneys.findUnique({
        where: { rollNumber: rollNo },
        select: { status: true },
      });
      if (roll && roll.status !== 'ACTIVE') {
        return res.status(404).json({ error: 'Lawyer not found.' });
      }
    }
    delete lawyer.lawyerVerification;
    lawyer.consultationFeeMin = lawyerFeeMin(lawyer);
    lawyer.consultationFeeMax = lawyerFeeMax(lawyer);
    lawyer.consultationFee = lawyerFeeMin(lawyer);

    const reviews = await prisma.review.findMany({
      where: { booking: { lawyerId: lawyer.id } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        citizen: { select: { name: true } },
      },
    });

    res.json({
      lawyer: {
        ...lawyer,
        specializations: parseJsonArray(lawyer.specializations),
        paymentMethods: parseJsonArray(lawyer.paymentMethods),
        credentials: parseJsonArray(lawyer.credentials),
      },
      reviews,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/lawyers/:id/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Open (unbooked) future slots for a lawyer.
 * Auth-gated because this is normally only useful right before booking.
 */
router.get('/:id/availability', requireAuth, requireCitizen, requireCitizenVerified, async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const from = req.query.from ? new Date(req.query.from) : today;
    const to = req.query.to ? new Date(req.query.to) : new Date(today.getTime() + 30 * 86400 * 1000);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return res.status(400).json({ error: 'Invalid date range.' });
    }

    const lawyerId = req.params.id;
    const slots = await prisma.availability.findMany({
      where: {
        lawyerId,
        date: { gte: from, lte: to },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      select: { id: true, date: true, startTime: true, endTime: true },
    });

    const live = await prisma.booking.findMany({
      where: {
        lawyerId,
        status: { in: LIVE_SESSION_STATUSES },
        availability: { date: { gte: from, lte: to } },
      },
      select: {
        availabilityId: true,
        preferredStartTime: true,
        sessionStartTime: true,
        sessionEndTime: true,
        availability: { select: { startTime: true, endTime: true } },
      },
    });

    const takenByWindow = new Map();
    for (const b of live) {
      const interval = sessionInterval(b, b.availability.startTime, b.availability.endTime);
      const list = takenByWindow.get(b.availabilityId) || [];
      list.push(interval);
      takenByWindow.set(b.availabilityId, list);
    }

    res.json({
      slots: slots.map((s) => {
        const taken = takenByWindow.get(s.id) || [];
        const openStarts = preferredStartsInWindow(s.startTime, s.endTime, taken);
        return {
          id: s.id,
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          isBooked: openStarts.length === 0,
          openStarts,
          taken,
        };
      }).filter((s) => s.openStarts.length > 0),
    });
  } catch (error) {
    next(error);
  }
});

// Helper: parse a JSON string column safely back to an array
// (or [] if it's null/garbage).
function parseJsonArray(s) {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export default router;
