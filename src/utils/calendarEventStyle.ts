export type CalendarColorVariant = 'grey' | 'green' | 'yellow' | 'orange' | 'blue';

const COMPLETED_STATUSES = new Set(['COMPLETED', 'RATED']);

/** Citizen booking statuses → calendar chip color. */
export function citizenBookingCalendarStyle(status: string): {
  colorVariant: CalendarColorVariant;
  completed: boolean;
} {
  if (COMPLETED_STATUSES.has(status)) {
    return { colorVariant: 'grey', completed: true };
  }
  switch (status) {
    case 'REQUESTED':
      return { colorVariant: 'green', completed: false };
    case 'APPROVED':
    case 'PAYMENT_SUBMITTED':
      return { colorVariant: 'yellow', completed: false };
    case 'CONFIRMED':
    case 'IN_PROGRESS':
      return { colorVariant: 'orange', completed: false };
    default:
      return { colorVariant: 'grey', completed: false };
  }
}
