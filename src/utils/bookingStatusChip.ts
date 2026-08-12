export const STATUS_CHIP_LABEL: Record<string, string> = {
  REQUESTED: 'Awaiting lawyer',
  APPROVED: 'Approved: pay now',
  PAYMENT_SUBMITTED: 'Payment sent: awaiting verification',
  CONFIRMED: 'Confirmed',
  IN_PROGRESS: 'In Session',
  COMPLETED: 'Completed',
  RATED: 'Reviewed',
  DECLINED: 'Declined',
  AUTO_CANCELLED: 'Auto-Cancelled',
  NO_SHOW: 'No-Show',
};

export function statusChipClass(status: string): string {
  const key = status.toLowerCase().replace(/_/g, '-');
  const known = [
    'requested',
    'approved',
    'payment-submitted',
    'confirmed',
    'in-progress',
    'completed',
    'rated',
    'declined',
    'auto-cancelled',
    'no-show',
  ];
  if (known.includes(key)) return `status-chip status-chip--${key}`;
  return 'status-chip status-chip--default';
}

export function statusChipLabel(
  status: string,
  viewerRole?: 'CITIZEN' | 'LAWYER',
): string {
  if (status === 'REQUESTED' && viewerRole === 'LAWYER') {
    return 'Action needed';
  }
  return STATUS_CHIP_LABEL[status] ?? status.replace(/_/g, ' ');
}
