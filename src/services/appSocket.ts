// ============================================================
// Ordinex — Shared Socket.IO client (notifications + booking events)
// ============================================================
import { io, type Socket } from 'socket.io-client';
import type { AppNotification } from './api';
import { getToken } from './api';

let shared: Socket | null = null;
let refCount = 0;

function getSharedSocket(): Socket | null {
  const token = getToken();
  if (!token) return null;
  const authToken = (shared?.auth as { token?: string } | undefined)?.token;
  if (shared && authToken !== token) {
    shared.removeAllListeners();
    shared.disconnect();
    shared = null;
    refCount = 0;
  }
  if (!shared) {
    shared = io({
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });
  }
  return shared;
}

/** Force disconnect (logout or session end). */
export function disconnectAppSocket(): void {
  refCount = 0;
  if (shared) {
    shared.removeAllListeners();
    shared.disconnect();
    shared = null;
  }
}

/** Keep one connection while any subscriber is mounted. */
export function retainAppSocket(): Socket | null {
  const s = getSharedSocket();
  if (s) refCount += 1;
  return s;
}

export function releaseAppSocket(): void {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0 && shared) {
    shared.removeAllListeners();
    shared.disconnect();
    shared = null;
  }
}

/** Whether the shared app socket is connected (live updates available). */
export function isAppSocketConnected(): boolean {
  return Boolean(shared?.connected);
}

export function onNotificationNew(handler: (n: AppNotification) => void): () => void {
  const s = retainAppSocket();
  if (!s) return () => {};
  s.on('notification:new', handler);
  return () => {
    s.off('notification:new', handler);
    releaseAppSocket();
  };
}

export function onBookingUpdated(handler: (payload: { bookingId: string }) => void): () => void {
  const s = retainAppSocket();
  if (!s) return () => {};
  s.on('booking:updated', handler);
  return () => {
    s.off('booking:updated', handler);
    releaseAppSocket();
  };
}

export function onAvailabilityChanged(handler: (payload: { lawyerId: string }) => void): () => void {
  const s = retainAppSocket();
  if (!s) return () => {};
  s.on('availability:changed', handler);
  return () => {
    s.off('availability:changed', handler);
    releaseAppSocket();
  };
}
