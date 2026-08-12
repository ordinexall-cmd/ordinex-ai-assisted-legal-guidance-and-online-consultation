/**
 * Admin routes — KYC review queue.
 * Auth: JWT user whose email is in ADMIN_EMAILS (comma-separated) or role === 'ADMIN'.
 */
import { Router } from 'express';
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
      linkTo: '/lawyer/register?phase=kyc',
    }).catch(() => {});
    res.json({ ok: true, ...out });
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: err.message });
    next(err);
  }
});

export default router;
