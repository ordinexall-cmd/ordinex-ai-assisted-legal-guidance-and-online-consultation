export const GUEST_DRAFT_KEY = 'ordinex_guest_draft';

export interface GuestDraft {
  description: string;
  category?: string;
  autoAnalyze?: boolean;
  /** After login: run live analysis, or open the lawyer directory (verification-gated). */
  intent?: 'analyze' | 'lawyers';
}

export function getGuestDraft(): GuestDraft | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(GUEST_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuestDraft;
    if (typeof parsed?.description === 'string' && parsed.description.trim().length > 0) {
      return {
        description: parsed.description,
        category: parsed.category,
        autoAnalyze: Boolean(parsed.autoAnalyze),
        intent: parsed.intent === 'lawyers' ? 'lawyers' : 'analyze',
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function setGuestDraft(draft: GuestDraft): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(GUEST_DRAFT_KEY, JSON.stringify(draft));
}

export function clearGuestDraft(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(GUEST_DRAFT_KEY);
}

export function hasGuestDraft(): boolean {
  return getGuestDraft() !== null;
}

/** Citizen destination after auth when a landing preview draft is waiting. Saved only in this browser until they Sign in or Log in. */
export function getCitizenPostAuthPath(): string {
  const draft = getGuestDraft();
  if (!draft) return '/dashboard';
  if (draft.intent === 'lawyers') {
    const specialty = draft.category && draft.category !== 'unsure' ? draft.category : '';
    return specialty ? `/directory?specialty=${encodeURIComponent(specialty)}` : '/directory';
  }
  return '/ai-analysis';
}
