// ============================================================
// Ordinex — Persisted in-app notifications + realtime push
// ============================================================
import { prisma } from '../config/prisma.js';
import { emitNotificationToUser } from '../socket/bookingSocket.js';

/**
 * @param {{ userId: string; title: string; message: string; type: string; linkTo?: string | null }}
 */
export async function createNotification({ userId, title, message, type, linkTo = null }) {
  const row = await prisma.notification.create({
    data: { userId, title, message, type, linkTo },
    select: { id: true, title: true, message: true, type: true, isRead: true, linkTo: true, createdAt: true },
  });
  emitNotificationToUser(userId, row);
  return row;
}
