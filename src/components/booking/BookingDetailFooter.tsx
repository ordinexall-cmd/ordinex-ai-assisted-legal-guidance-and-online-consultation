import React from 'react';
import { Link } from 'react-router-dom';

export interface BookingDetailFooterProps {
  readonly onReportUser?: () => void;
}

export const BookingDetailFooter: React.FC<BookingDetailFooterProps> = ({ onReportUser }) => (
  <footer className="booking-detail-footer">
    <div className="booking-detail-footer__help">
      <span className="material-symbols-outlined booking-detail-footer__icon" aria-hidden>
        help
      </span>
      <p className="booking-detail-footer__text">
        Need help with this booking? Our support team is here to assist you.
      </p>
    </div>
    <div className="booking-detail-footer__actions">
      {onReportUser && (
        <button type="button" className="ox-btn booking-detail-footer__report" onClick={onReportUser}>
          <span className="material-symbols-outlined" aria-hidden>flag</span>
          Report user
        </button>
      )}
      <Link to="/settings" className="ox-btn ox-btn-secondary booking-detail-footer__cta">
        <span className="material-symbols-outlined" aria-hidden>chat</span>
        Contact support
      </Link>
    </div>
  </footer>
);

export default BookingDetailFooter;
