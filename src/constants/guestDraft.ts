export const GUEST_DRAFT_KEY = 'ordinex_guest_draft';

export interface GuestDraft {
  description: string;
}

export function getGuestDraft(): GuestDraft | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(GUEST_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuestDraft;
    if (typeof parsed?.description === 'string' && parsed.description.trim().length > 0) {
      return { description: parsed.description };
    }
    return null;
  } catch {
    return null;
  }
}

export function setGuestDraft(draft: GuestDraft): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(GUEST_DRAFT_KEY, JSON.stringify({ description: draft.description }));
}

export function clearGuestDraft(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(GUEST_DRAFT_KEY);
}

export function hasGuestDraft(): boolean {
  return getGuestDraft() !== null;
}

/** Citizen destination after auth when a landing preview draft is waiting. */
export function getCitizenPostAuthPath(): string {
  if (hasGuestDraft()) return '/ai-analysis';
  return '/dashboard';
}
