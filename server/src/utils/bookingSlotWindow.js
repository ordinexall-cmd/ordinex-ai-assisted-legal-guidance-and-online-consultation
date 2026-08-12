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

export function isBookingSlotActive(availability, now = new Date()) {
  const start = parseBookingSlotDateTime(availability.date, availability.startTime);
  const end = parseBookingSlotDateTime(availability.date, availability.endTime);
  return now >= start && now < end;
}

export function canJoinBookingVideo(availability, status, now = new Date(), demoBypass = false) {
  if (status === 'IN_PROGRESS') return true;
  if (status !== 'CONFIRMED') return false;
  if (demoBypass) return true;
  return isBookingSlotActive(availability, now);
}
