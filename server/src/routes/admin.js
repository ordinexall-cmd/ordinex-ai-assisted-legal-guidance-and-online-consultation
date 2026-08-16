/**
 * Admin routes — KYC review queue.
 * Auth: JWT user whose email is in ADMIN_EMAILS (comma-separated) or role === 'ADMIN'.
 */
import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { createNotification } from '../services/notify.js';
import {
  adminApproveVerification,
  adminRejectVerification,
  listPendingVerifications,
} from '../services/lawyerVerification.js';

const router = Router();

function isAdminUser(user) {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  const emails = String(env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return emails.includes(String(user.email || '').toLowerCase());
}

function requireAdmin(req, res, next) {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

router.use(requireAuth, requireAdmin);

router.get('/kyc/pending', async (req, res, next) => {
  try {
    const items = await listPendingVerifications({
      limit: parseInt(req.query.limit, 10) || 50,
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.post('/kyc/:userId/approve', async (req, res, next) => {
  try {
    const out = await adminApproveVerification({
      userId: req.params.userId,
      reason: req.body?.reason,
    });
    createNotification({
      userId: req.params.userId,
      title: 'Identity verified',
      message: 'An Ordinex reviewer approved your counsel verification. You can now appear in the directory.',
      type: 'VERIFICATION',
      linkTo: '/settings',
    }).catch(() => {});
    res.json({ ok: true, ...out });
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: err.message });
    next(err);
  }
});

router.post('/kyc/:userId/reject', async (req, res, next) => {
  try {
    const out = await adminRejectVerification({
      userId: req.params.userId,
      reason: req.body?.reason,
    });
    createNotification({
      userId: req.params.userId,
      title: 'Verification not approved',
      message: out.user.lawyerVerificationRejectionReason || 'Your verification was rejected. See Settings for details.',
      type: 'VERIFICATION',
      linkTo: '/settings?tab=verification',
    }).catch(() => {});
    res.json({ ok: true, ...out });
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: err.message });
    next(err);
  }
});

// ======================== TRUST & SAFETY: REPORTS ========================

/**
 * GET /api/admin/reports?status=PENDING
 * Review queue for user reports.
 */
router.get('/reports', async (req, res, next) => {
  try {
    const status = req.query.status;
    const where = status ? { status } : {};
    const reports = await prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(req.query.limit, 10) || 100,
      include: {
        reporter: { select: { id: true, name: true, email: true } },
        reportedUser: {
          select: {
            id: true, name: true, email: true, role: true,
            isBanned: true, suspensionUntil: true, suspensionReason: true,
          },
        },
      },
    });
    res.json({ reports });
  } catch (err) {
    next(err);
  }
});

const RESTRICTION_TIERS = {
  WARNING: { days: 0, label: 'formal warning' },
  RESTRICT_7: { days: 7, label: '7-day restriction' },
  RESTRICT_30: { days: 30, label: '30-day restriction' },
  BAN: { days: null, label: 'permanent ban' },
};

/**
 * POST /api/admin/reports/:id/action
 * Body: { tier: 'WARNING'|'RESTRICT_7'|'RESTRICT_30'|'BAN', note?: string }
 * Applies an escalating restriction to the reported user and closes the report.
 */
router.post('/reports/:id/action', async (req, res, next) => {
  try {
    const { tier, note } = req.body || {};
    const config = RESTRICTION_TIERS[tier];
    if (!config) {
      return res.status(400).json({ error: 'Invalid restriction tier.' });
    }

    const report = await prisma.report.findUnique({ where: { id: req.params.id } });
    if (!report) return res.status(404).json({ error: 'Report not found.' });

    const reason = (note || '').trim() || `Action from report ${report.id}: ${report.reason}`;
    const userData = {};

    if (tier === 'BAN') {
      userData.isBanned = true;
      userData.suspensionReason = reason;
      userData.suspensionUntil = null;
    } else if (config.days > 0) {
      userData.suspensionUntil = new Date(Date.now() + config.days * 24 * 60 * 60 * 1000);
      userData.suspensionReason = reason;
      userData.isBanned = false;
    } else {
      // WARNING — record reason, no access change
      userData.suspensionReason = reason;
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: report.reportedUserId }, data: userData }),
      prisma.report.update({ where: { id: report.id }, data: { status: 'ACTIONED' } }),
    ]);

    createNotification({
      userId: report.reportedUserId,
      title: tier === 'BAN' ? 'Account banned' : tier === 'WARNING' ? 'Formal warning issued' : 'Account restricted',
      message:
        tier === 'BAN'
          ? `Your account has been permanently banned. Reason: ${reason}`
          : tier === 'WARNING'
            ? `You have received a formal warning. Reason: ${reason}`
            : `Your account is restricted for ${config.label}. Reason: ${reason}`,
      type: 'MODERATION',
      linkTo: '/settings',
    }).catch(() => {});

    res.json({ ok: true, tier, appliedUntil: userData.suspensionUntil || null });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/reports/:id/dismiss
 * Resolve a report without action (e.g. after a valid dispute).
 */
router.post('/reports/:id/dismiss', async (req, res, next) => {
  try {
    const report = await prisma.report.update({
      where: { id: req.params.id },
      data: { status: 'RESOLVED' },
    }).catch(() => null);
    if (!report) return res.status(404).json({ error: 'Report not found.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/users/:id/lift-restriction
 * Clears an active suspension or ban.
 */
router.post('/users/:id/lift-restriction', async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.params.id },
      data: { isBanned: false, suspensionUntil: null, suspensionReason: null },
    });
    createNotification({
      userId: req.params.id,
      title: 'Restriction lifted',
      message: 'Your account restriction has been lifted. Full access is restored.',
      type: 'MODERATION',
      linkTo: '/settings',
    }).catch(() => {});
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
