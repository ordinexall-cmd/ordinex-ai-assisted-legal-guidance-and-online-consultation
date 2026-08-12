import React from 'react';
import type { Booking } from '../../services/api';

const STEPS = [
  { key: 'REQUESTED', label: 'Request' },
  { key: 'APPROVED', label: 'Quote & Pay' },
  { key: 'CONFIRMED', label: 'Confirmed' },
] as const;

function stepIndex(status: Booking['status']): number {
  if (status === 'CONFIRMED' || status === 'IN_PROGRESS' || status === 'COMPLETED' || status === 'RATED') return 2;
  if (status === 'APPROVED' || status === 'PAYMENT_SUBMITTED') return 1;
  if (status === 'REQUESTED') return 0;
  return -1;
}

export const BookingPaymentStepper: React.FC<{ readonly status: Booking['status'] }> = ({ status }) => {
  const current = stepIndex(status);
  if (current < 0) return null;

  return (
    <ol className="booking-payment-stepper" aria-label="Booking progress">
      {STEPS.map((s, i) => (
        <li
          key={s.key}
          className={`booking-payment-stepper__step${i <= current ? ' is-done' : ''}${i === current ? ' is-current' : ''}`}
        >
          <span className="booking-payment-stepper__dot" aria-hidden />
          <span className="booking-payment-stepper__label">{s.label}</span>
        </li>
      ))}
    </ol>
  );
};

export default BookingPaymentStepper;
