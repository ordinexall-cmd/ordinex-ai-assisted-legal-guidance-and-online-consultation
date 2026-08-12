/**
 * Light text preprocessing (spaCy-equivalent stage in Node).
 */
export function preprocessConcern(text) {
  const raw = (text || '').trim();
  const normalized = raw
    .replace(/\s+/g, ' ')
    .replace(/[^\S\n]+/g, ' ');

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;

  // Check for vagueness: too short, generic filler phrases, or missing specifics
  const isVague = normalized.length < 40
    || /\b(idk|not sure|help me|something happened)\b/i.test(normalized)
    || (wordCount < 15 && !/(\d{4}|last (week|month|year)|pesos|₱|barangay|city|police|court)/i.test(normalized));

  return {
    raw,
    normalized,
    isVague,
    wordCount,
  };
}

export function tokenizeForMatch(text) {
  return [...new Set(
    (text || '').toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2),
  )];
}
