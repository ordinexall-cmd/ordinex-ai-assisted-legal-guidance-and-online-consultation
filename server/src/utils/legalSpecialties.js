/** Canonical English practice areas for matching (must stay in sync with client legalCategories.ts). */

export const CANONICAL_SPECIALTIES = [
  'Family',
  'Criminal',
  'Labor',
  'Property',
  'Consumer',
  'Cybercrime',
  'Data Privacy',
];

const KEYWORDS = [
  { match: /\bfamily\b|\bcustody\b|\bdivorce\b|\bannulment\b|\basawa\b|\banak\b|\bhiwalay\b/i, value: 'Family' },
  { match: /\bcriminal\b|\bestafa\b|\btheft\b|\bassault\b|\bkriminal\b/i, value: 'Criminal' },
  { match: /\blabor\b|\bemployment\b|\billegal\s*dismissal\b|\btrabaho\b|\bdole\b/i, value: 'Labor' },
  { match: /\bproperty\b|\breal\s*estate\b|\bland\b|\btitulo\b|\blupa\b/i, value: 'Property' },
  { match: /\bconsumer\b|\bwarranty\b|\brefund\b/i, value: 'Consumer' },
  { match: /\bcyber\b|\bonline\s*scam\b|\bhacking\b/i, value: 'Cybercrime' },
  { match: /\bprivacy\b|\bdata\s*privacy\b|\bndpr\b/i, value: 'Data Privacy' },
];

/**
 * Map free-text / category / AI specialty into a single English enum value.
 * Returns null when unsure / General.
 */
export function resolveCanonicalSpecialty({ category, lawyerSpecialty, matchSpecialty } = {}) {
  const explicit = (matchSpecialty || '').trim();
  if (CANONICAL_SPECIALTIES.includes(explicit)) return explicit;

  const cat = (category || '').trim();
  if (CANONICAL_SPECIALTIES.includes(cat)) return cat;

  const text = `${lawyerSpecialty || ''} ${cat}`.trim();
  if (!text) return null;

  for (const { match, value } of KEYWORDS) {
    if (match.test(text)) return value;
  }
  return null;
}
