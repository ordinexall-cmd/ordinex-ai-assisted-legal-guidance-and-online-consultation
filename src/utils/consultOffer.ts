export const CONSULT_OFFER_DURATIONS = [30, 60, 90] as const;
export type ConsultOfferDuration = (typeof CONSULT_OFFER_DURATIONS)[number];
export const OFFER_MESSAGE_MIN = 20;
export const OFFER_MESSAGE_MAX = 500;

export function isConsultOfferDuration(n: number): n is ConsultOfferDuration {
  return (CONSULT_OFFER_DURATIONS as readonly number[]).includes(n);
}

export function consultDurationLabel(minutes: number): string {
  if (minutes === 30) return '30 min';
  if (minutes === 60) return '1 hour';
  if (minutes === 90) return '1.5 hours';
  return `${minutes} min`;
}
