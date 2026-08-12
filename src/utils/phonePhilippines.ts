/** Normalize to 09XXXXXXXXX for API calls. */
export function normalizePhilippinePhone(raw: string): string | null {
  if (!raw?.trim()) return null;
  let p = raw.replace(/\s|-/g, '').trim();
  if (p.startsWith('+63')) p = `0${p.slice(3)}`;
  else if (p.startsWith('63')) p = `0${p.slice(2)}`;
  else if (/^9\d{9}$/.test(p)) p = `0${p}`;
  if (!/^09\d{9}$/.test(p)) return null;
  return p;
}

/** Local digits after country code: 9XXXXXXXXX (max 10). */
export function phoneToLocalPart(full: string): string {
  const n = normalizePhilippinePhone(full);
  if (!n) return full.replace(/\D/g, '').slice(0, 10);
  return n.slice(1);
}

export function localPartToFullPhone(local: string): string | null {
  const digits = local.replace(/\D/g, '');
  if (!digits) return null;
  return normalizePhilippinePhone(digits.startsWith('0') ? digits : `0${digits}`);
}

export function formatPhilippinePhoneDisplay(normalized: string): string {
  const local = normalized.startsWith('0') ? normalized.slice(1) : normalized;
  if (local.length <= 3) return local;
  if (local.length <= 6) return `${local.slice(0, 3)} ${local.slice(3)}`;
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

export function isValidPhilippinePhoneLocal(local: string): boolean {
  return /^9\d{9}$/.test(local.replace(/\D/g, ''));
}
