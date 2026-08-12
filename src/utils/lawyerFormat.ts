export function bookingStatusLabel(status: string): string {
  switch (status) {
    case 'REQUESTED':
      return 'REQUESTED';
    case 'APPROVED':
      return 'APPROVED';
    case 'PAYMENT_SUBMITTED':
      return 'PAYMENT';
    case 'CONFIRMED':
    case 'IN_PROGRESS':
      return 'APPROVED';
    default:
      return status.replace(/_/g, ' ');
  }
}
