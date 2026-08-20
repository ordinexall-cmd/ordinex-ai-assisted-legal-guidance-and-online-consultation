export type BookingSlotInfo = {
  date: string;
  startTime: string;
  endTime: string;
};

export type BookingSlotPhase = 'before' | 'active' | 'after';

function dayKey(dateStr: string): string {
  return dateStr.slice(0, 10);
}

/** Parse YYYY-MM-DD + HH:MM in the user's local timezone. */
export function parseBookingSlotDateTime(dateStr: string, timeStr: string): Date {
  const day = dayKey(dateStr);
  const [y, mo, d] = day.split('-').map((n) => parseInt(n, 10));
  const [h, mi] = timeStr.trim().split(':').map((n) => parseInt(n, 10));
  return new Date(y, mo - 1, d, h, mi || 0, 0, 0);
}

export function getBookingSlotBounds(slot: BookingSlotInfo): { start: Date; end: Date } {
  return {
    start: parseBookingSlotDateTime(slot.date, slot.startTime),
    end: parseBookingSlotDateTime(slot.date, slot.endTime),
  };
}

export function getBookingSlotPhase(slot: BookingSlotInfo, now = new Date()): BookingSlotPhase {
  const { start, end } = getBookingSlotBounds(slot);
  if (now < start) return 'before';
  if (now >= end) return 'after';
  return 'active';
}

export function isBookingSlotActive(slot: BookingSlotInfo, now = new Date()): boolean {
  return getBookingSlotPhase(slot, now) === 'active';
}

function isJoinExtended(joinExtendedUntil: string | Date | null | undefined, now: Date): boolean {
  if (!joinExtendedUntil) return false;
  return now < new Date(joinExtendedUntil);
}

/** Video join: during the booked slot, extended wait, or reconnect while session is in progress. */
export function canJoinBookingVideo(
  slot: BookingSlotInfo,
  status: string,
  now = new Date(),
  demoBypass = false,
  joinExtendedUntil?: string | Date | null,
): boolean {
  if (status === 'IN_PROGRESS') return true;
  if (status !== 'CONFIRMED') return false;
  if (demoBypass) return true;
  if (isBookingSlotActive(slot, now)) return true;
  if (isJoinExtended(joinExtendedUntil, now)) return true;
  return false;
}

export function bookingSlotJoinHintForDemo(): string {
  return 'Demo account: video is available for this confirmed booking.';
}

export function formatBookingSlotRange(slot: BookingSlotInfo): string {
  const day = new Date(dayKey(slot.date) + 'T12:00:00').toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return `${day}, ${slot.startTime}–${slot.endTime}`;
}

export function bookingSlotJoinHint(
  slot: BookingSlotInfo,
  now = new Date(),
  joinExtendedUntil?: string | Date | null,
): string {
  if (isJoinExtended(joinExtendedUntil, now)) {
    const until = new Date(joinExtendedUntil!);
    return `Waiting extended — you can join until ${until.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}.`;
  }
  const phase = getBookingSlotPhase(slot, now);
  const range = formatBookingSlotRange(slot);
  if (phase === 'before') {
    const { start } = getBookingSlotBounds(slot);
    return `Video opens at ${start.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })} (${range}).`;
  }
  if (phase === 'after') {
    return `The scheduled time for this consultation has ended (${range}). Use Continue waiting, Reschedule, or Cancel & refund below.`;
  }
  return 'You can join the video call now.';
}
