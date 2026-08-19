import React from 'react';
import type { Booking } from '../../services/api';
import { statusChipClass, statusChipLabel } from '../../utils/bookingStatusChip';

const peso = (n: number | null | undefined) =>
  (n == null ? 'Ask' : n === 0 ? 'Free' : `₱${n.toLocaleString()}`);

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

interface BookingDetailHeroProps {
  readonly booking: Booking;
  readonly counterpartyName: string;
  readonly isLawyerViewer: boolean;
  readonly onToggleClientProfile?: () => void;
  readonly onOpenAnalysis?: () => void;
}

export const BookingDetailHero: React.FC<BookingDetailHeroProps> = ({
  booking,
  counterpartyName,
  isLawyerViewer,
  onToggleClientProfile,
  onOpenAnalysis,
}) => (
  <div className="ox-card booking-detail-hero booking-detail-hero--mock">
    <div className="booking-detail-hero__head">
      <div className="booking-detail-hero__head-main">
        <p className="booking-detail-hero__eyebrow">
          <span className="material-symbols-outlined booking-detail-hero__eyebrow-icon" aria-hidden>
            calendar_today
          </span>
          Booking summary
        </p>
        {isLawyerViewer && onToggleClientProfile ? (
          <button
            type="button"
            className="booking-detail-hero__name booking-detail-hero__name--link"
            onClick={onToggleClientProfile}
          >
            {counterpartyName}
          </button>
        ) : (
          <h2 className="booking-detail-hero__name">{counterpartyName}</h2>
        )}
      </div>
      <span className={statusChipClass(booking.status)}>
        {statusChipLabel(booking.status, booking.viewerRole)}
      </span>
    </div>

    <div className="booking-detail-hero__stats">
      <div className="stat-tile stat-tile--mock">
        <span className="material-symbols-outlined stat-tile__icon" aria-hidden>calendar_today</span>
        <p className="stat-tile__label">Date</p>
        <p className="stat-tile__value">{fmtDate(booking.availability.date)}</p>
      </div>
      <div className="stat-tile stat-tile--mock">
        <span className="material-symbols-outlined stat-tile__icon" aria-hidden>schedule</span>
        <p className="stat-tile__label">Time</p>
        <p className="stat-tile__value">
          {booking.availability.startTime}
          {' – '}
          {booking.availability.endTime}
        </p>
      </div>
      <div className="stat-tile stat-tile--mock">
        <span className="material-symbols-outlined stat-tile__icon" aria-hidden>sell</span>
        <p className="stat-tile__label">Fee</p>
        <p className="stat-tile__value">{peso(booking.feeAtBooking)}</p>
      </div>
    </div>

    <div className="booking-detail-hero__case">
      <p className="booking-detail-hero__case-label">Case description</p>
      <p className="booking-detail-hero__case-text">
        {booking.caseDescription?.trim() || 'No description provided.'}
      </p>
    </div>

    {booking.consultationId ? (
      <p className="booking-detail-hero__ai-link">
        {booking.linkedAnalysisPreview && (
          <span className="booking-detail-hero__ai-chip">AI case attached</span>
        )}
        {onOpenAnalysis ? (
          <button type="button" className="link-inline" onClick={onOpenAnalysis}>
            {isLawyerViewer ? 'Jump to case identification' : 'View linked case identification'}
            <span className="material-symbols-outlined" aria-hidden>arrow_forward</span>
          </button>
        ) : null}
      </p>
    ) : null}
  </div>
);

export default BookingDetailHero;
