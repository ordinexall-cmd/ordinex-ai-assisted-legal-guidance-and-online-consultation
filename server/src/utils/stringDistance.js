// ============================================================
// String similarity helpers for identity verification scoring.
// Used by lawyer name matching: SC Roll entry vs OCR-extracted
// ID name vs payment-account name. Returns 0..1 similarity.
// ============================================================

/**
 * Lowercase, strip punctuation and Filipino-common honorifics like
 * "Atty.", "Ma.", "Jr.", "III" so common name variants compare equal.
 */
export function normalizeFullName(input) {
  if (!input || typeof input !== 'string') return '';
  let s = input.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/[.,_/\\]/g, ' ');
  s = s.replace(/\b(atty|attorney|hon|sir|madam|mr|mrs|ms|dr)\b/g, ' ');
  s = s.replace(/\b(jr|sr|ii|iii|iv|v)\b/g, ' ');
  s = s.replace(/\b(ma|maria|ma\b)\b/g, 'maria');
  s = s.replace(/[^a-z\s]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/** Tokenize normalized name into a sorted, deduped word array. */
export function nameTokens(input) {
  const norm = normalizeFullName(input);
  if (!norm) return [];
  return Array.from(new Set(norm.split(' ').filter(Boolean))).sort();
}

/**
 * Classic Levenshtein edit distance (iterative, O(m*n) memory-efficient
 * single-row implementation). Handles small inputs (names ≤ 80 chars).
 */
export function levenshtein(a, b) {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;

  let prev = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  const curr = new Array(lb + 1);

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= lb; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
    }
    const tmp = prev;
    prev = curr.slice();
    // reuse curr next iteration
    for (let k = 0; k <= lb; k++) curr[k] = tmp[k];
  }
  return prev[lb];
}

/** Levenshtein expressed as similarity in [0,1] (1 = identical). */
export function levenshteinSimilarity(a, b) {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

/**
 * Token-set similarity: high when both names share most tokens regardless
 * of order. Robust to "Juan dela Cruz" vs "dela Cruz, Juan".
 */
export function tokenSetSimilarity(a, b) {
  const ta = new Set(nameTokens(a));
  const tb = new Set(nameTokens(b));
  if (ta.size === 0 && tb.size === 0) return 1;
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return inter / union;
}

/**
 * Composite name similarity used by the verification scoring engine.
 * Combines Levenshtein on the normalized whole string with Jaccard on
 * token sets so single-letter typos AND reordered name fragments both
 * score well.
 */
export function nameSimilarity(a, b) {
  const na = normalizeFullName(a);
  const nb = normalizeFullName(b);
  if (!na || !nb) return 0;
  const lev = levenshteinSimilarity(na, nb);
  const jac = tokenSetSimilarity(a, b);
  // weighted blend; token overlap matters more for human names
  return Math.max(0, Math.min(1, lev * 0.4 + jac * 0.6));
}
