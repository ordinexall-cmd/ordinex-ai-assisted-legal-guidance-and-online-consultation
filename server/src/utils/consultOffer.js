export const CONSULT_OFFER_DURATIONS = [30, 60, 90];
export const OFFER_MESSAGE_MIN = 20;
export const OFFER_MESSAGE_MAX = 500;

export function isConsultOfferDuration(n) {
  return CONSULT_OFFER_DURATIONS.includes(Number(n));
}

export function consultDurationLabel(minutes) {
  const n = Number(minutes);
  if (n === 30) return '30 min';
  if (n === 60) return '1 hour';
  if (n === 90) return '1.5 hours';
  return `${n} min`;
}
