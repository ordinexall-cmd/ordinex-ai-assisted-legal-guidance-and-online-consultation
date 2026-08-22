/**
 * Keep Identify "need more detail" gates on narrative story facts only.
 * Proof docs / certificates belong in results as optional "what to prepare".
 */

const DOC_PROOF_RE =
  /\b(medical\s*(certificate|cert|findings|record)|doctor'?s?\s*(certificate|note)|lab(oratory)?\s*(test|result)|physical\s*custody|original\s*packaging|photograph|photo|image|upload|attach(ment|ed)?|screenshot|documentary\s*evidence|sworn\s*statement|affidavit|witness\s*statement|documents?\s+(or\s+)?evidence|ebidensya|dokumento)\b/i;

export function filterNarrativeMissingFacts(facts: unknown): string[] {
  if (!Array.isArray(facts)) return [];
  return facts
    .map((f) => String(f || '').trim())
    .filter((f) => f.length > 0 && !DOC_PROOF_RE.test(f));
}
