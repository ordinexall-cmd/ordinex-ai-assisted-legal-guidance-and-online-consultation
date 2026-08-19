/**
 * Reliable Philippine legal publishers. Used for live search, scrape, and preload links.
 * Not news, Wikipedia, blogs, or commercial case dumps.
 */
const EXTRA_HOSTS = new Set([
  'lawphil.net',
  'www.lawphil.net',
  'officialgazette.gov.ph',
  'www.officialgazette.gov.ph',
  'elibrary.judiciary.gov.ph',
  'sc.judiciary.gov.ph',
  'www.sc.judiciary.gov.ph',
  'senate.gov.ph',
  'www.senate.gov.ph',
  'congress.gov.ph',
  'www.congress.gov.ph',
  'erc.ph',
  'www.erc.ph',
]);

const BLOCKED_HOST_RE =
  /wikipedia\.|wikimedia\.|facebook\.|twitter\.|x\.com|chanrobles|inquirer\.|gmanetwork|gma\.|rappler\.|abs-cbn|philstar|manilabulletin|reddit\.|medium\.com|blogspot|wordpress\.com|youtube\./i;

export function isAllowedPhLegalHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^www\./, '');
  if (!host) return false;
  if (BLOCKED_HOST_RE.test(host)) return false;
  if (host.endsWith('.gov.ph')) return true;
  if (host.endsWith('.judiciary.gov.ph')) return true;
  if (EXTRA_HOSTS.has(host) || EXTRA_HOSTS.has(`www.${host}`)) return true;
  return false;
}

export function isAllowedPhLegalUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    if (!/^https?:$/i.test(parsed.protocol)) return false;
    return isAllowedPhLegalHost(parsed.hostname);
  } catch {
    return false;
  }
}
