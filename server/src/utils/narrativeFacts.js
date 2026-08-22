/**
 * Keep Identify "need more detail" gates on narrative story facts only.
 * Proof docs / certificates belong in results as optional "what to prepare".
 */

const DOC_PROOF_RE =
  /\b(medical\s*(certificate|cert|findings|record)|doctor'?s?\s*(certificate|note)|lab(oratory)?\s*(test|result)|physical\s*custody|original\s*packaging|photograph|photo|image|upload|attach(ment|ed)?|screenshot|documentary\s*evidence|sworn\s*statement|affidavit|witness\s*statement|documents?\s+(or\s+)?evidence|ebidensya|dokumento)\b/i;

/**
 * @param {string[]} facts
 * @returns {string[]}
 */
export function filterNarrativeMissingFacts(facts) {
  if (!Array.isArray(facts)) return [];
  return facts
    .map((f) => String(f || '').trim())
    .filter((f) => f.length > 0 && !DOC_PROOF_RE.test(f));
}

/**
 * Soft scrub of model missingFacts so proof-doc language never blocks Identify.
 * @param {object} result
 * @returns {object}
 */
export function scrubAnalysisMissingFacts(result) {
  if (!result?.courtWinOutlook) return result;
  const cleaned = filterNarrativeMissingFacts(result.courtWinOutlook.missingFacts || []);
  return {
    ...result,
    courtWinOutlook: {
      ...result.courtWinOutlook,
      missingFacts: cleaned,
    },
  };
}
