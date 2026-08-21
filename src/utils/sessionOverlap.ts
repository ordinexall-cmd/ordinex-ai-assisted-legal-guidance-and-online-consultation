export const HOLD_MINUTES = 60;
export const MIN_SESSION_MINUTES = 15;
export const GRID_MINUTES = 15;

export function timeToMinutes(t: string): number {
  const [h, m] = String(t || '').trim().split(':').map((n) => parseInt(n, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
}

export function minutesToTime(mins: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, Math.round(mins)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function holdEnd(start: string, windowEnd: string, durationMinutes: number = HOLD_MINUTES): string {
  const dur = Number(durationMinutes);
  const needed = Number.isFinite(dur) && dur > 0 ? dur : HOLD_MINUTES;
  const endMins = Math.min(timeToMinutes(start) + needed, timeToMinutes(windowEnd));
  return minutesToTime(endMins);
}

export function intervalsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(bStart) < timeToMinutes(aEnd);
}

export function preferredStartsInWindow(
  windowStart: string,
  windowEnd: string,
  taken: { start: string; end: string }[],
  durationMinutes?: number,
): string[] {
  const winEnd = timeToMinutes(windowEnd);
  const requireFull = Number.isFinite(Number(durationMinutes)) && Number(durationMinutes) > 0;
  const needed = requireFull ? Number(durationMinutes) : HOLD_MINUTES;
  const starts: string[] = [];
  for (let t = timeToMinutes(windowStart); t + MIN_SESSION_MINUTES <= winEnd; t += GRID_MINUTES) {
    if (requireFull && t + needed > winEnd) continue;
    const start = minutesToTime(t);
    const end = requireFull ? minutesToTime(t + needed) : holdEnd(start, windowEnd);
    if (timeToMinutes(end) - timeToMinutes(start) < MIN_SESSION_MINUTES) continue;
    if (taken.some((x) => intervalsOverlap(start, end, x.start, x.end))) continue;
    starts.push(start);
  }
  return starts;
}
