/**
 * Normalize Philippine mobile numbers to 09XXXXXXXXX (11 digits).
 * Accepts: 09..., +639..., 639..., or 9XXXXXXXXX (when +63 is shown separately in UI).
 */
export function normalizePhilippinePhone(raw) {
  if (raw == null || raw === '') return null;
  let p = String(raw).replace(/\s|-/g, '').trim();
  if (p.startsWith('+63')) p = `0${p.slice(3)}`;
  else if (p.startsWith('63')) p = `0${p.slice(2)}`;
  else if (/^9\d{9}$/.test(p)) p = `0${p}`;
  if (!/^09\d{9}$/.test(p)) return null;
  return p;
}

/** Semaphore API expects international format: 639XXXXXXXXX (no +). */
export function toSemaphoreNumber(phone09) {
  const normalized = normalizePhilippinePhone(phone09);
  if (!normalized) return null;
  return `63${normalized.slice(1)}`;
}
