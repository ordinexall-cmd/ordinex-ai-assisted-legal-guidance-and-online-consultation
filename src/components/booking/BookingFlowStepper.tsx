import React from 'react';

export type BookingFlowStep = 'lawyer' | 'schedule' | 'manage';

const STEPS: readonly { id: BookingFlowStep; label: string; num: number }[] = [
  { id: 'lawyer', label: 'Lawyer', num: 1 },
  { id: 'schedule', label: 'Schedule', num: 2 },
  { id: 'manage', label: 'Confirmation', num: 3 },
];

interface BookingFlowStepperProps {
  readonly current: BookingFlowStep;
  readonly variant?: 'horizontal' | 'vertical';
}

export const BookingFlowStepper: React.FC<BookingFlowStepperProps> = ({
  current,
  variant = 'horizontal',
}) => {
  const order: BookingFlowStep[] = ['lawyer', 'schedule', 'manage'];
  const currentIdx = order.indexOf(current);
  const isVertical = variant === 'vertical';

  return (
    <nav
      className={`flow-stepper${isVertical ? ' flow-stepper--vertical' : ' flow-stepper--narrow'}`}
      aria-label="Booking progress"
    >
      {STEPS.map((step, i) => {
        const isDone = i < currentIdx;
        const isCurrent = i === currentIdx;
        const dotClass = isDone
          ? 'flow-step__dot flow-step__dot--done'
          : isCurrent
            ? 'flow-step__dot flow-step__dot--current'
            : 'flow-step__dot flow-step__dot--todo';
        const labelClass = isDone
          ? 'flow-step__label flow-step__label--done'
          : isCurrent
            ? 'flow-step__label flow-step__label--active'
            : 'flow-step__label';

        return (
          <React.Fragment key={step.id}>
            {i > 0 && (
              <div
                className={`flow-connector${isVertical ? ' flow-connector--vertical' : ''}${i <= currentIdx ? ' flow-connector--active' : ''}`}
                aria-hidden
              />
            )}
            <div className="flow-step">
              <span className={dotClass} aria-current={isCurrent ? 'step' : undefined}>
                {isDone ? (
                  <span className="material-symbols-outlined flow-step__check" aria-hidden>
                    check
                  </span>
                ) : (
                  step.num
                )}
              </span>
              <span className={labelClass}>{step.label}</span>
            </div>
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default BookingFlowStepper;
