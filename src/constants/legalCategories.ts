/** Canonical legal areas — shared by AI case analysis, lawyer profiles, and directory matching. */

export const CASE_ANALYSIS_CATEGORIES = [
  { value: 'Family', label: 'Family Law' },
  { value: 'Criminal', label: 'Criminal Law' },
  { value: 'Labor', label: 'Labor & Employment' },
  { value: 'Property', label: 'Property Law' },
  { value: 'Consumer', label: 'Consumer Protection' },
  { value: 'Cybercrime', label: 'Cybercrime' },
  { value: 'Data Privacy', label: 'Data Privacy' },
  { value: 'unsure', label: "I'm not sure" },
] as const;

export type CaseAnalysisCategory = (typeof CASE_ANALYSIS_CATEGORIES)[number]['value'];

/** Values lawyers can select in settings (excludes "unsure"). */
export const LEGAL_PRACTICE_AREAS = CASE_ANALYSIS_CATEGORIES.filter((c) => c.value !== 'unsure');

const SPECIALTY_KEYWORDS: ReadonlyArray<{ match: RegExp; value: string }> = [
  { match: /\bfamily\b|\bcustody\b|\bdivorce\b|\bannulment\b|\basawa\b|\banak\b|\bhiwalay\b/i, value: 'Family' },
  { match: /\bcriminal\b|\bestafa\b|\btheft\b|\bassault\b|\bkriminal\b/i, value: 'Criminal' },
  { match: /\blabor\b|\bemployment\b|\billegal\s*dismissal\b|\btrabaho\b|\bdole\b/i, value: 'Labor' },
  { match: /\bproperty\b|\breal\s*estate\b|\bland\b|\btitulo\b|\blupa\b/i, value: 'Property' },
  { match: /\bconsumer\b|\bwarranty\b|\brefund\b/i, value: 'Consumer' },
  { match: /\bcyber\b|\bonline\s*scam\b|\bhacking\b/i, value: 'Cybercrime' },
  { match: /\bprivacy\b|\bdata\s*privacy\b|\bndpr\b/i, value: 'Data Privacy' },
];

export function specialtyDisplayLabel(specialty: string): string {
  const found = CASE_ANALYSIS_CATEGORIES.find((c) => c.value === specialty);
  return found?.label ?? specialty;
}

/**
 * Resolve directory filter specialty from analysis inputs.
 * Primary: citizen-selected category; fallback: AI lawyerSpecialty text.
 */
export function resolveMatchSpecialty(input: {
  category?: string | null;
  lawyerSpecialty?: string | null;
  matchSpecialty?: string | null;
}): string | null {
  const explicit = (input.matchSpecialty || '').trim();
  if (explicit && explicit !== 'General' && explicit !== 'unsure') {
    const found = CASE_ANALYSIS_CATEGORIES.find((c) => c.value === explicit);
    if (found) return found.value;
  }

  const cat = (input.category || '').trim();
  if (cat && cat !== 'unsure') return cat;

  const text = (input.lawyerSpecialty || '').trim();
  if (!text) return null;

  for (const { match, value } of SPECIALTY_KEYWORDS) {
    if (match.test(text)) return value;
  }
  return null;
}

export function lawyerMatchesSpecialty(
  specializations: readonly string[],
  specialty: string,
): boolean {
  const needle = specialty.trim().toLowerCase();
  if (!needle) return false;
  return specializations.some((s) => {
    const hay = s.trim().toLowerCase();
    return hay === needle || hay.includes(needle) || needle.includes(hay);
  });
}

export function buildLawyersPath(opts: {
  specialty?: string | null;
  consultationId?: string | null;
} = {}): string {
  const params = new URLSearchParams();
  if (opts.specialty) params.set('specialty', opts.specialty);
  if (opts.consultationId) params.set('consultationId', opts.consultationId);
  const qs = params.toString();
  return qs ? `/lawyers?${qs}` : '/lawyers';
}

export function appendConsultationIdToPath(
  path: string,
  consultationId?: string | null,
): string {
  if (!consultationId) return path;
  const [base, existingQs] = path.split('?');
  const params = new URLSearchParams(existingQs || '');
  params.set('consultationId', consultationId);
  return `${base}?${params.toString()}`;
}

export function buildLawyerBookPath(lawyerId: string, consultationId?: string | null): string {
  return appendConsultationIdToPath(`/lawyers/${lawyerId}/book`, consultationId);
}
