// ============================================================
// Ordinex — User reports (trust & safety)
// ============================================================
import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { persistUploadedFile, reportUpload } from '../services/uploads.js';

const router = Router();

const REASONS = new Set(['HARASSMENT', 'NO_SHOW', 'SCAM', 'INAPPROPRIATE', 'OTHER']);

function parseReportBody(req, res, next) {
  const ct = req.headers['content-type'] || '';
  if (ct.includes('multipart/form-data')) {
    return reportUpload.single('screenshot')(req, res, next);
  }
  next();
}

/**
 * POST /api/reports
 * JSON or multipart/form-data (optional screenshot file).
 */
router.post('/', requireAuth, parseReportBody, async (req, res, next) => {
  try {
    const reportedUserId = req.body.reportedUserId || req.body.reported_user_id;
    const reason = req.body.reason;
    const description = (req.body.description || '').trim();
    const bookingId = req.body.bookingId || req.body.booking_id || null;

    if (!reportedUserId || typeof reportedUserId !== 'string') {
      return res.status(400).json({ error: 'reportedUserId is required.' });
    }
    if (reportedUserId === req.user.id) {
      return res.status(400).json({ error: 'You cannot report yourself.' });
    }
    if (!reason || !REASONS.has(reason)) {
      return res.status(400).json({ error: 'Invalid or missing reason.' });
    }
    if (description.length < 10) {
      return res.status(400).json({ error: 'Please describe the issue (at least 10 characters).' });
    }

    const reported = await prisma.user.findUnique({ where: { id: reportedUserId }, select: { id: true } });
    if (!reported) return res.status(404).json({ error: 'Reported user not found.' });

    if (bookingId) {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { id: true, citizenId: true, lawyerId: true },
      });
      if (!booking) return res.status(404).json({ error: 'Booking not found.' });
      const isParty = booking.citizenId === req.user.id || booking.lawyerId === req.user.id;
      if (!isParty) return res.status(403).json({ error: 'You are not a party to this booking.' });
      const other = booking.citizenId === req.user.id ? booking.lawyerId : booking.citizenId;
      if (reportedUserId !== other) {
        return res.status(400).json({ error: 'Reported user must be the other party on this booking.' });
      }
    }

    let screenshotUrl = req.body.screenshotUrl?.trim() || null;
    if (req.file) {
      screenshotUrl = await persistUploadedFile(req.file, 'reports');
    }

    const report = await prisma.report.create({
      data: {
        reporterId: req.user.id,
        reportedUserId,
        bookingId: bookingId || null,
        reason,
        description,
        screenshotUrl,
      },
      select: {
        id: true, reason: true, status: true, createdAt: true,
      },
    });

    res.status(201).json({ message: 'Report submitted.', report });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/reports/:id
 * Reporter or reported party can view their report.
 */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const report = await prisma.report.findUnique({
      where: { id: req.params.id },
      include: {
        reporter: { select: { id: true, name: true } },
        reportedUser: { select: { id: true, name: true } },
      },
    });
    if (!report) return res.status(404).json({ error: 'Report not found.' });
    const isParty = report.reporterId === req.user.id || report.reportedUserId === req.user.id;
    if (!isParty) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    res.json({ report });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/reports/:id/dispute
 * Reported user submits a dispute (status → DISPUTED).
 */
router.post('/:id/dispute', requireAuth, parseReportBody, async (req, res, next) => {
  try {
    const disputeText = (req.body.disputeText || req.body.dispute_text || '').trim();
    if (disputeText.length < 10) {
      return res.status(400).json({ error: 'Please explain your dispute (at least 10 characters).' });
    }

    const report = await prisma.report.findUnique({ where: { id: req.params.id } });
    if (!report) return res.status(404).json({ error: 'Report not found.' });
    if (report.reportedUserId !== req.user.id) {
      return res.status(403).json({ error: 'Only the reported user can dispute.' });
    }
    if (report.status !== 'PENDING' && report.status !== 'DISPUTED') {
      return res.status(409).json({ error: 'This report cannot be disputed in its current state.' });
    }

    let disputeProofUrl = req.body.disputeProofUrl?.trim() || null;
    if (req.file) {
      disputeProofUrl = await persistUploadedFile(req.file, 'reports');
    }

    const updated = await prisma.report.update({
      where: { id: report.id },
      data: {
        disputeText,
        disputeProofUrl,
        disputedAt: new Date(),
        status: 'DISPUTED',
      },
    });

    res.json({ message: 'Dispute submitted.', report: updated });
  } catch (error) {
    next(error);
  }
});

export default router;
