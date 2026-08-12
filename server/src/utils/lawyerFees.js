/**
 * Effective consultation fee range for a lawyer profile row.
 */
export function lawyerFeeMin(lawyer) {
  if (lawyer.consultationFeeMin != null) return lawyer.consultationFeeMin;
  if (lawyer.consultationFee != null) return lawyer.consultationFee;
  return 0;
}

export function lawyerFeeMax(lawyer) {
  if (lawyer.consultationFeeMax != null) return lawyer.consultationFeeMax;
  return lawyerFeeMin(lawyer);
}
