/** Minimum length for case description when no case identification is linked. */
export const MIN_BOOKING_CASE_DESCRIPTION_LENGTH = 1;

export function hasBookingCaseContext({ consultationId, caseDescription }) {
  const id = consultationId?.trim?.() ?? consultationId;
  if (id) return true;
  const desc = (caseDescription?.trim?.() ?? caseDescription ?? '').trim();
  return desc.length >= MIN_BOOKING_CASE_DESCRIPTION_LENGTH;
}

export function bookingCaseContextError() {
  return 'Link a past case identification or enter a short case description (at least one is required).';
}
