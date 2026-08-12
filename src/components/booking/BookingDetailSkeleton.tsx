import React from 'react';
import { BookingFlowLayout } from './BookingFlowLayout';

export const BookingDetailSkeleton: React.FC = () => (
  <BookingFlowLayout
    step="manage"
    main={(
      <div className="booking-flow-main-stack" aria-busy="true" aria-label="Loading booking">
        <div className="ox-card booking-detail-skeleton-card" />
        <div className="ox-card booking-detail-skeleton-card booking-detail-skeleton-card--action" />
      </div>
    )}
    aside={(
      <>
        <div className="ox-card booking-detail-skeleton-card booking-detail-skeleton-card--aside" />
        <div className="ox-card booking-detail-skeleton-card booking-detail-skeleton-card--aside" />
      </>
    )}
  />
);

export default BookingDetailSkeleton;
