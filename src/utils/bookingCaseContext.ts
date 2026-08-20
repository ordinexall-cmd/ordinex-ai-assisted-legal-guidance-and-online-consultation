/** Minimum length for case description when no case identification is linked. */
export const MIN_BOOKING_CASE_DESCRIPTION_LENGTH = 1;

export function hasBookingCaseContext(input: {
  consultationId?: string | null;
  caseDescription?: string | null;
}): boolean {
  const id = input.consultationId?.trim();
  if (id) return true;
  const desc = input.caseDescription?.trim() ?? '';
  return desc.length >= MIN_BOOKING_CASE_DESCRIPTION_LENGTH;
}

export function bookingCaseContextError(): string {
  return 'Link a past case identification or enter a short case description (at least one is required).';
}
