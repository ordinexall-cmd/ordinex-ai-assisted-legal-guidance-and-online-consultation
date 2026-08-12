import React from 'react';
import type { BookingStatus } from '../../services/api';
import '../../styles/consult-booking.css';

const FLOW_STEPS = ['REQUESTED', 'APPROVED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] as const;

const STEP_LABELS: Record<string, string> = {
  REQUESTED: 'Requested',
  APPROVED: 'Approved',
  CONFIRMED: 'Confirmed',
  IN_PROGRESS: 'Live',
  COMPLETED: 'Done',
};

const BAD_TERMINAL = new Set(['DECLINED', 'AUTO_CANCELLED', 'NO_SHOW', 'CANCELLED']);

function resolveStepIndex(status: BookingStatus): number {
  if (status === 'PAYMENT_SUBMITTED') return 1;
  if (status === 'RATED') return 4;
  const idx = FLOW_STEPS.indexOf(status as (typeof FLOW_STEPS)[number]);
  return idx >= 0 ? idx : -1;
}

export interface BookingStatusStepperProps {
  readonly status: BookingStatus;
}

export const BookingStatusStepper: React.FC<BookingStatusStepperProps> = ({ status }) => {
  const isBad = BAD_TERMINAL.has(status);
  const activeIdx = resolveStepIndex(status);

  if (isBad) {
    return (
      <div className="consult-alert consult-alert--error" role="status">
        Booking status: <strong>{status.replace(/_/g, ' ')}</strong>
      </div>
    );
  }

  return (
    <div>
      <div className="booking-status-stepper" aria-label="Booking progress">
        {FLOW_STEPS.map((step, i) => {
          const done = activeIdx >= i;
          const active = activeIdx === i;
          return (
            <React.Fragment key={step}>
              {i > 0 && (
                <div
                  className={`booking-status-stepper__connector${done ? ' booking-status-stepper__connector--done' : ''}`}
                  aria-hidden
                />
              )}
              <div
                className={`booking-status-stepper__dot${done ? ' booking-status-stepper__dot--done' : ''}${active ? ' booking-status-stepper__dot--active' : ''}`}
                title={STEP_LABELS[step]}
              >
                {done && !active ? '✓' : i + 1}
              </div>
            </React.Fragment>
          );
        })}
      </div>
      <div className="booking-status-stepper__labels">
        {FLOW_STEPS.map((step, i) => (
          <span
            key={step}
            className={`booking-status-stepper__label${activeIdx === i ? ' booking-status-stepper__label--active' : ''}`}
          >
            {STEP_LABELS[step]}
          </span>
        ))}
      </div>
    </div>
  );
};

export default BookingStatusStepper;
