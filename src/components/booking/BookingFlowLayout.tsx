import React from 'react';
import { BookingFlowStepper, type BookingFlowStep } from './BookingFlowStepper';

export type BookingFlowLayoutVariant = 'default' | 'schedule' | 'manage';

interface BookingFlowLayoutProps {
  readonly step: BookingFlowStep;
  readonly main: React.ReactNode;
  readonly aside?: React.ReactNode;
  readonly footer?: React.ReactNode;
  readonly variant?: BookingFlowLayoutVariant;
}

export const BookingFlowLayout: React.FC<BookingFlowLayoutProps> = ({
  step,
  main,
  aside,
  footer,
  variant = 'default',
}) => (
  <div
    className={`booking-flow-layout booking-flow-layout--${variant}${aside ? '' : ' booking-flow-layout--no-aside'}`}
  >
    <div className="booking-flow-rail">
      <BookingFlowStepper current={step} variant="vertical" />
    </div>
    <div className="booking-flow-main">{main}</div>
    {aside ? <div className="booking-flow-aside">{aside}</div> : null}
    {footer ? <div className="booking-flow-footer-slot">{footer}</div> : null}
  </div>
);

export default BookingFlowLayout;
