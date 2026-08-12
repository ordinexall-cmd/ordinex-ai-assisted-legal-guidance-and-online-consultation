// ============================================================
// Ordinex — Socket.IO (user notifications + booking rooms)
// ============================================================
import { Server } from 'socket.io';
import { verifyToken } from '../utils/jwt.js';
import { prisma } from '../config/prisma.js';

/** @type {import('socket.io').Server | null} */
let io = null;

/**
 * @param {import('http').Server} httpServer
 * @param {{ corsOrigin: string }} opts
 */
export function initBookingSocket(httpServer, { corsOrigin }) {
  io = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: corsOrigin, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token || typeof token !== 'string') {
        return next(new Error('Unauthorized'));
      }
      const decoded = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, isBanned: true },
      });
      if (!user || user.isBanned) return next(new Error('Unauthorized'));
      socket.data.userId = user.id;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`);

    socket.on('booking:join', async (payload, ack) => {
      try {
        const bookingId = payload?.bookingId;
        if (!bookingId || typeof bookingId !== 'string') {
          return ack?.({ ok: false, error: 'bookingId is required.' });
        }
        const b = await prisma.booking.findUnique({
          where: { id: bookingId },
          select: { citizenId: true, lawyerId: true },
        });
        if (!b) return ack?.({ ok: false, error: 'Booking not found.' });
        if (b.citizenId !== socket.data.userId && b.lawyerId !== socket.data.userId) {
          return ack?.({ ok: false, error: 'Forbidden.' });
        }
        await socket.join(`booking:${bookingId}`);
        ack?.({ ok: true });
      } catch (e) {
        ack?.({ ok: false, error: e.message || 'join failed' });
      }
    });

    socket.on('booking:leave', async (payload) => {
      const bookingId = payload?.bookingId;
      if (bookingId && typeof bookingId === 'string') {
        await socket.leave(`booking:${bookingId}`);
      }
    });
  });

  return io;
}

/**
 * @param {string} bookingId
 * @param {object} message
 */
export function emitBookingChatMessage(bookingId, message) {
  io?.to(`booking:${bookingId}`).emit('booking:chat', message);
}

export function emitBookingChatClosed(bookingId) {
  io?.to(`booking:${bookingId}`).emit('booking:chat-closed', { bookingId });
}

export function emitBookingTranscriptSegment(bookingId, segment) {
  io?.to(`booking:${bookingId}`).emit('booking:transcript', { bookingId, segment });
}

/**
 * Tell both parties (and anyone in the booking room) that state changed.
 * @param {string} bookingId
 * @param {string} citizenId
 * @param {string} lawyerId
 */
export function emitBookingChanged(bookingId, citizenId, lawyerId) {
  const payload = { bookingId };
  io?.to(`booking:${bookingId}`).emit('booking:updated', payload);
  io?.to(`user:${citizenId}`).emit('booking:updated', payload);
  io?.to(`user:${lawyerId}`).emit('booking:updated', payload);
}

/**
 * Push a new in-app notification to a user's live session(s).
 * @param {string} userId
 * @param {object} notification
 */
export function emitNotificationToUser(userId, notification) {
  io?.to(`user:${userId}`).emit('notification:new', notification);
}

/** Notify lawyer and citizens viewing their schedule that slots changed. */
export function emitAvailabilityChanged(lawyerId) {
  const payload = { lawyerId };
  io?.to(`user:${lawyerId}`).emit('availability:changed', payload);
  io?.emit('availability:changed', payload);
}
