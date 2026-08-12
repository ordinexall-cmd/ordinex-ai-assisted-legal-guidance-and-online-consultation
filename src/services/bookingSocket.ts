// ============================================================
// Ordinex — Booking room (chat, transcript, status)
// ============================================================
import type { Socket } from 'socket.io-client';
import type { BookingChatMessage, TranscriptSegment } from './api';
import { retainAppSocket, releaseAppSocket } from './appSocket';

function joinBookingRoom(socket: Socket, bookingId: string) {
  const emitJoin = () => {
    socket.emit('booking:join', { bookingId }, (ack: { ok?: boolean; error?: string } | undefined) => {
      if (ack && ack.ok === false) console.warn('[socket] booking:join', ack.error);
    });
  };
  if (socket.connected) emitJoin();
  else socket.once('connect', emitJoin);
}

export type BookingRoomHandlers = {
  onChat?: (msg: BookingChatMessage) => void;
  onTranscript?: (segment: TranscriptSegment) => void;
  onChatClosed?: () => void;
};

type TranscriptPayload = { segment?: TranscriptSegment };
const transcriptWrappers = new WeakMap<
  BookingRoomHandlers,
  (payload: TranscriptPayload) => void
>();

/**
 * Join booking room for live sync (citizen + lawyer see the same chat/transcript).
 */
export function connectBookingRoom(
  bookingId: string,
  handlers: BookingRoomHandlers,
): Socket | null {
  const socket = retainAppSocket();
  if (!socket) return null;

  joinBookingRoom(socket, bookingId);

  if (handlers.onChat) {
    socket.on('booking:chat', handlers.onChat);
  }
  if (handlers.onTranscript) {
    const wrapper = (payload: TranscriptPayload) => {
      if (payload?.segment) handlers.onTranscript!(payload.segment);
    };
    transcriptWrappers.set(handlers, wrapper);
    socket.on('booking:transcript', wrapper);
  }
  if (handlers.onChatClosed) {
    socket.on('booking:chat-closed', handlers.onChatClosed);
  }

  return socket;
}

export function disconnectBookingRoom(
  socket: Socket | null,
  bookingId?: string,
  handlers?: BookingRoomHandlers,
) {
  if (!socket) return;
  if (bookingId) socket.emit('booking:leave', { bookingId });
  if (handlers?.onChat) socket.off('booking:chat', handlers.onChat);
  if (handlers?.onTranscript) {
    const wrapper = transcriptWrappers.get(handlers);
    if (wrapper) socket.off('booking:transcript', wrapper);
  }
  if (handlers?.onChatClosed) socket.off('booking:chat-closed', handlers.onChatClosed);
  releaseAppSocket();
}

