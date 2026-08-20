function dayKey(date) {
  if (date instanceof Date) return date.toISOString().slice(0, 10);
  return String(date).slice(0, 10);
}

function parseBookingSlotDateTime(dateStr, timeStr) {
  const day = dayKey(dateStr);
  const [y, mo, d] = day.split('-').map((n) => parseInt(n, 10));
  const [h, mi] = String(timeStr).trim().split(':').map((n) => parseInt(n, 10));
  return new Date(y, mo - 1, d, h, mi || 0, 0, 0);
}

export { parseBookingSlotDateTime };

export function getBookingSlotBounds(availability, sessionStartTime, sessionEndTime) {
  const startTime = sessionStartTime || availability.startTime;
  const endTime = sessionEndTime || availability.endTime;
  return {
    start: parseBookingSlotDateTime(availability.date, startTime),
    end: parseBookingSlotDateTime(availability.date, endTime),
  };
}

export function isBookingSlotActive(availability, now = new Date(), sessionStartTime, sessionEndTime) {
  const { start, end } = getBookingSlotBounds(availability, sessionStartTime, sessionEndTime);
  return now >= start && now < end;
}

function isJoinExtended(joinExtendedUntil, now) {
  if (!joinExtendedUntil) return false;
  return now < new Date(joinExtendedUntil);
}

export function canJoinBookingVideo(
  availability,
  status,
  now = new Date(),
  demoBypass = false,
  joinExtendedUntil = null,
  sessionStartTime,
  sessionEndTime,
) {
  if (status === 'IN_PROGRESS') return true;
  if (status !== 'CONFIRMED') return false;
  if (demoBypass) return true;
  if (isBookingSlotActive(availability, now, sessionStartTime, sessionEndTime)) return true;
  if (isJoinExtended(joinExtendedUntil, now)) return true;
  return false;
}

/** Lawyer has another live booking starting within buffer minutes after slot end. */
export function slotEndsAt(availability, sessionEndTime) {
  const endTime = sessionEndTime || availability.endTime;
  return parseBookingSlotDateTime(availability.date, endTime);
}
