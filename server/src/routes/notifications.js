// ============================================================
// Ordinex — Notifications API
// ============================================================
import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/notifications?page=&limit=
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const where = { userId: req.user.id };
    const [items, total, unread] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true, title: true, message: true, type: true, isRead: true, linkTo: true, createdAt: true,
        },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { ...where, isRead: false } }),
    ]);

    res.json({
      notifications: items,
      unreadCount: unread,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/notifications/read-all
 */
router.patch('/read-all', requireAuth, async (req, res, next) => {
  try {
    const result = await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });
    res.json({ updated: result.count });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/notifications/:id/read
 */
router.patch('/:id/read', requireAuth, async (req, res, next) => {
  try {
    const n = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!n) return res.status(404).json({ error: 'Notification not found.' });

    const updated = await prisma.notification.update({
      where: { id: n.id },
      data: { isRead: true },
      select: { id: true, title: true, message: true, type: true, isRead: true, linkTo: true, createdAt: true },
    });
    res.json({ notification: updated });
  } catch (error) {
    next(error);
  }
});

export default router;
