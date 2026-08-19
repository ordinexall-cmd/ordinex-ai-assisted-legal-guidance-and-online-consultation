export const LIVE_SESSION_STATUSES = [
  'REQUESTED',
  'APPROVED',
  'PAYMENT_SUBMITTED',
  'CONFIRMED',
  'IN_PROGRESS',
];

export const HOLD_MINUTES = 60;
export const MIN_SESSION_MINUTES = 15;
export const GRID_MINUTES = 15;

export function normalizeHm(t) {
  const parts = String(t || '').trim().split(':');
  if (parts.length < 2) return '';
  const h = parseInt(parts[0], 10);
  const m = parseInt(String(parts[1]).slice(0, 2), 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
  return minutesToTime(h * 60 + m);
}

export function timeToMinutes(t) {
  const n = normalizeHm(t);
  const [h, m] = n.split(':').map((x) => parseInt(x, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
}

export function minutesToTime(mins) {
  const clamped = Math.max(0, Math.min(24 * 60, Math.round(mins)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(bStart) < timeToMinutes(aEnd);
}

export function holdEnd(start, windowEnd) {
  const endMins = Math.min(timeToMinutes(start) + HOLD_MINUTES, timeToMinutes(windowEnd));
  return minutesToTime(endMins);
}

export function sessionInterval(booking, windowStart, windowEnd) {
  const start = booking.sessionStartTime || booking.preferredStartTime || windowStart;
  const end = booking.sessionEndTime || holdEnd(start, windowEnd);
  return { start, end };
}

export function preferredStartsInWindow(windowStart, windowEnd, taken) {
  const winEnd = timeToMinutes(windowEnd);
  const starts = [];
  for (let t = timeToMinutes(windowStart); t + MIN_SESSION_MINUTES <= winEnd; t += GRID_MINUTES) {
    const start = minutesToTime(t);
    const end = holdEnd(start, windowEnd);
    if (timeToMinutes(end) - timeToMinutes(start) < MIN_SESSION_MINUTES) continue;
    if ((taken || []).some((x) => intervalsOverlap(start, end, x.start, x.end))) continue;
    starts.push(start);
  }
  return starts;
}

export function validateSessionRange(start, end, windowStart, windowEnd) {
  const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
  const s = normalizeHm(start);
  const e = normalizeHm(end);
  const ws = normalizeHm(windowStart);
  const we = normalizeHm(windowEnd);
  if (!TIME_RE.test(s) || !TIME_RE.test(e)) {
    return 'Use times as HH:MM.';
  }
  if (timeToMinutes(e) - timeToMinutes(s) < MIN_SESSION_MINUTES) {
    return 'The session must be at least 15 minutes.';
  }
  if (timeToMinutes(s) < timeToMinutes(ws) || timeToMinutes(e) > timeToMinutes(we)) {
    return `The session must stay inside ${ws}–${we}.`;
  }
  return null;
}
