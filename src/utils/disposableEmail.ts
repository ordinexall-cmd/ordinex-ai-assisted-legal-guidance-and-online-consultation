/**
 * Disposable & Temporary Email Domain Blocklist and Normalizer
 * Prevents disposable throwaway emails and duplicate multi-account registration abuse.
 */

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  '10minutemail.com',
  'tempmail.com',
  'guerrillamail.com',
  'sharklasers.com',
  'throwawaymail.com',
  'yopmail.com',
  'trashmail.com',
  'dispostable.com',
  'fakeinbox.com',
  'getairmail.com',
  'mytemp.email',
  'nada.ltd',
  'temp-mail.org',
  'generator.email',
  'dropmail.me',
  'getnada.com',
  'inboxkitten.com',
  'mohmal.com',
]);

/**
 * Checks if an email uses a known disposable email domain.
 */
export function isDisposableEmail(email: string): boolean {
  if (!email || !email.includes('@')) return false;
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1];
  return DISPOSABLE_DOMAINS.has(domain);
}

/**
 * Normalizes email address by trimming, lowercasing, and handling sub-addressing (e.g. user+alias@gmail.com -> user@gmail.com).
 */
export function normalizeEmail(email: string): string {
  if (!email || !email.includes('@')) return email.trim().toLowerCase();
  const [local, domain] = email.trim().toLowerCase().split('@');
  if (!domain) return email.trim().toLowerCase();

  // Strip +aliases for standard providers
  const baseLocal = local.split('+')[0];

  // For Gmail, also strip periods
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    const cleanLocal = baseLocal.replace(/\./g, '');
    return `${cleanLocal}@gmail.com`;
  }

  return `${baseLocal}@${domain}`;
}
