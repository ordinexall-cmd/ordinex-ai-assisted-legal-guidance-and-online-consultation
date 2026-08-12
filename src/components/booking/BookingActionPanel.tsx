import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingsApi, type Booking } from '../../services/api';
import { useBookingSlotWindow } from '../../hooks/useBookingSlotWindow';
import { BookingPaymentStepper } from './BookingPaymentStepper';

const peso = (n: number | null | undefined) =>
  (n == null ? 'Ask' : n === 0 ? 'Free' : `₱${n.toLocaleString()}`);

const COMMISSION_RATE = 0.10;

export interface BookingActionPanelProps {
  readonly booking: Booking;
  readonly loading: boolean;
  readonly onAction: (fn: () => Promise<{ booking: Booking }>) => void;
  readonly onViewClientProfile?: () => void;
}

export const BookingActionPanel: React.FC<BookingActionPanelProps> = ({
  booking,
  loading,
  onAction,
  onViewClientProfile,
}) => {
  const navigate = useNavigate();
  const isCitizen = booking.viewerRole === 'CITIZEN';
  const isLawyer = booking.viewerRole === 'LAWYER';
  const [quotedFeeInput, setQuotedFeeInput] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  const feeMin = booking.lawyer.consultationFee ?? 0;
  // Use lawyer profile fee range if available
  const lawyerFeeMin = (booking.lawyer as any).consultationFeeMin ?? feeMin;
  const lawyerFeeMax = (booking.lawyer as any).consultationFeeMax ?? lawyerFeeMin;
  const isPaidLawyer = lawyerFeeMax > 0;

  const parsedQuotedFee = parseFloat(quotedFeeInput) || 0;
  const platformFee = Math.round(parsedQuotedFee * COMMISSION_RATE * 100) / 100;
  const lawyerReceives = parsedQuotedFee - platformFee;
  const citizenTotal = parsedQuotedFee; // citizen pays exactly the quoted fee
  const isQuoteValid = isPaidLawyer
    ? parsedQuotedFee >= lawyerFeeMin && parsedQuotedFee <= lawyerFeeMax
    : true;

  const slotWindow = useBookingSlotWindow(booking.availability, booking.status);

  const card = (children: React.ReactNode, accent = false) => (
    <div className={`ox-card booking-action-card booking-action-card--mock${accent ? ' ox-card-accent' : ''}`}>
      {isPaidLawyer && booking.status !== 'REQUESTED' && (
        <BookingPaymentStepper status={booking.status} />
      )}
      {children}
    </div>
  );

  const actionTitle = (text: string) => (
    <h3 className="booking-action-card__title">{text}</h3>
  );

  const actionText = (children: React.ReactNode) => (
    <p className="booking-action-card__text">{children}</p>
  );

  switch (booking.status) {
    case 'REQUESTED':
      return card(
        isCitizen ? (
          <div className="booking-waiting-card">
            <span className="material-symbols-outlined booking-waiting-card__icon" aria-hidden>
              hourglass_top
            </span>
            <div>
              <h3 className="booking-waiting-card__title">Waiting for {booking.lawyer.name}</h3>
              <p className="booking-waiting-card__text">
                Lawyers typically respond within 24 hours. You&apos;ll get a notification when they approve or decline.
              </p>
            </div>
          </div>
        ) : (
          <>
            {actionTitle('New booking request')}
            {actionText(
              'Review the client case details, then set a fee for this request. Citizens pay after you quote — there is no fixed price at booking time.',
            )}
            {onViewClientProfile && (
              <button
                type="button"
                className="booking-profile-link"
                onClick={onViewClientProfile}
              >
                View client profile
                <span className="material-symbols-outlined" aria-hidden>chevron_right</span>
              </button>
            )}

            {/* Quote input for paid lawyers */}
            {isPaidLawyer && (
              <div className="quote-input-section">
                <p className="quote-input-section__title">Set consultation fee</p>
                <div className="quote-input-row">
                  <span className="quote-input-row__prefix">₱</span>
                  <input
                    className="ox-input quote-input-row__input"
                    type="number"
                    min={lawyerFeeMin}
                    max={lawyerFeeMax}
                    step="1"
                    placeholder={`${lawyerFeeMin.toLocaleString()} – ${lawyerFeeMax.toLocaleString()}`}
                    value={quotedFeeInput}
                    onChange={(e) => setQuotedFeeInput(e.target.value)}
                  />
                </div>
                <p className="quote-input-section__hint">
                  Your profile range is ₱{lawyerFeeMin.toLocaleString()} – ₱{lawyerFeeMax.toLocaleString()}.
                  Quote the exact fee after reading this citizen&apos;s concern.
                </p>
                {parsedQuotedFee > 0 && isQuoteValid && (
                  <div className="quote-breakdown">
                    <div className="quote-breakdown__row quote-breakdown__row--total">
                      <span>Citizen pays</span>
                      <span>{peso(citizenTotal)}</span>
                    </div>
                    <div className="quote-breakdown__row">
                      <span>Ordinex service fee (10%)</span>
                      <span>−{peso(platformFee)}</span>
                    </div>
                    <div className="quote-breakdown__row">
                      <span>You receive (90%)</span>
                      <span>{peso(lawyerReceives)}</span>
                    </div>
                  </div>
                )}
                {parsedQuotedFee > 0 && !isQuoteValid && (
                  <p className="quote-input-section__hint" style={{ color: 'var(--color-ox-error)' }}>
                    Fee must be between ₱{lawyerFeeMin.toLocaleString()} and ₱{lawyerFeeMax.toLocaleString()}.
                  </p>
                )}
              </div>
            )}

            <div className="booking-action-card__footer">
              <button
                type="button"
                disabled={loading || (isPaidLawyer && (!isQuoteValid || parsedQuotedFee <= 0))}
                onClick={() => {
                  onAction(() => bookingsApi.approve(
                    booking.id,
                    isPaidLawyer ? parsedQuotedFee : undefined,
                  ));
                }}
                className="ox-btn ox-btn-primary ox-btn-full"
              >
                {isPaidLawyer ? `Approve · ${peso(parsedQuotedFee)}` : 'Approve'}
              </button>
              <button type="button" disabled={loading} onClick={() => onAction(() => bookingsApi.decline(booking.id))}
                className="ox-btn booking-btn-decline ox-btn-full">
                Decline
              </button>
            </div>
          </>
        )
      );

    case 'APPROVED':
      if (!isCitizen) {
        return card(<>
          {actionTitle('Approved · Awaiting payment')}
          {actionText(<>
            Quoted fee: <strong>{peso(booking.quotedFee)}</strong>.
            The citizen has 24 hours to pay (GCash via PayMongo).
            {booking.approvedAt && (
              <> Expires {new Date(new Date(booking.approvedAt).getTime() + 24 * 60 * 60 * 1000).toLocaleString()}.</>
            )}
          </>)}
        </>);
      }
      return card(<>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-ox-emerald)' }}>
          Approved! Complete payment to confirm.
        </h3>
        <div style={{ fontSize: 11, color: 'var(--color-ox-text-muted)', margin: '4px 0 10px' }}>
          <div className="quote-breakdown" style={{ marginTop: 8, marginBottom: 8 }}>
            <div className="quote-breakdown__row quote-breakdown__row--total">
              <span>Total</span>
              <span>{peso(booking.quotedFee)}</span>
            </div>
            <div className="quote-breakdown__row">
              <span>Includes Ordinex service fee (10%)</span>
              <span>{peso(booking.platformFee)}</span>
            </div>
          </div>
          <p style={{ margin: '4px 0', fontSize: 10, color: 'var(--color-ox-text-muted)' }}>
            Pay with GCash within 24 hours or the slot will be released.
          </p>
        </div>
        <button
          onClick={() => navigate(`/checkout?type=booking&bookingId=${booking.id}`)}
          className="ox-btn ox-btn-primary"
          style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>lock</span>
          Pay with GCash — {peso(booking.quotedFee)}
        </button>
      </>, true);

    case 'PAYMENT_SUBMITTED':
      return card(
        isCitizen ? (
          <>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-ox-emerald)' }}>Payment received · Awaiting verification</h3>
            <p style={{ fontSize: 11, color: 'var(--color-ox-text-muted)', marginTop: 4 }}>
              Reference: <strong>{booking.paymentReference}</strong>
            </p>
            <p style={{ fontSize: 11, color: 'var(--color-ox-text-muted)', marginTop: 4 }}>
              We'll notify you once the lawyer confirms. Auto-cancels after 48h if unverified.
            </p>
          </>
        ) : (
          <>
            {actionTitle('Verify payment')}
            {actionText(<>Reference submitted: <strong>{booking.paymentReference}</strong></>)}
            {booking.paymentReceiptUrl && (
              <a href={booking.paymentReceiptUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: 8 }}>
                <img
                  src={booking.paymentReceiptUrl}
                  alt="Payment receipt"
                  style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 8, objectFit: 'contain' }}
                />
              </a>
            )}
            <p style={{ fontSize: 10, color: 'var(--color-ox-text-muted)', marginTop: 4 }}>
              Cross-check the reference and screenshot with your GCash/Maya or bank inbox before confirming.
            </p>
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <button disabled={loading} onClick={() => onAction(() => bookingsApi.confirmPayment(booking.id))}
                className="ox-btn ox-btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                Confirm Payment
              </button>
              <button disabled={loading} onClick={() => onAction(() => bookingsApi.decline(booking.id))}
                className="ox-btn" style={{ flex: 1, justifyContent: 'center', background: 'transparent', border: '1px solid #BA1A1A', color: '#BA1A1A' }}>
                Reject & Refund
              </button>
            </div>
          </>
        )
      );

    case 'CONFIRMED':
    case 'IN_PROGRESS':
      return card(<>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-ox-emerald)' }}>Ready to consult</h3>
        <p style={{ fontSize: 11, color: 'var(--color-ox-text-muted)', margin: '4px 0 12px' }}>
          {slotWindow.canJoinVideo
            ? 'You will confirm device access and the recording/transcript policy before entering the private video room.'
            : slotWindow.hint}
        </p>
        <button
          type="button"
          disabled={!slotWindow.canJoinVideo}
          onClick={() => {
            if (slotWindow.canJoinVideo) navigate(`/consultation/${booking.id}/preflight`);
          }}
          className="ox-btn ox-btn-primary"
          style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6 }}
          title={slotWindow.canJoinVideo ? undefined : slotWindow.hint}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>videocam</span>
          Join Video Call
        </button>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {isLawyer && (
            <button disabled={loading} onClick={() => onAction(() => bookingsApi.complete(booking.id))}
              className="ox-btn" style={{ flex: 1, justifyContent: 'center', background: 'transparent', border: '1px solid var(--color-ox-emerald)', color: 'var(--color-ox-emerald)' }}>
              Close case & release payment
            </button>
          )}
          {!isLawyer && (
            <p style={{ fontSize: 11, color: 'var(--color-ox-text-muted)', margin: 0, width: '100%' }}>
              Your payment stays held until the lawyer closes the case after the consultation.
            </p>
          )}
          <button disabled={loading} onClick={() => onAction(() => bookingsApi.cancelRefund(booking.id))}
            className="ox-btn" style={{ flex: 1, justifyContent: 'center', background: 'transparent', border: '1px solid var(--color-ox-border)', color: 'var(--color-ox-text)' }}>
            Cancel & refund
          </button>
          <button disabled={loading} onClick={() => onAction(() => bookingsApi.noShow(booking.id))}
            className="ox-btn" style={{ flex: 1, justifyContent: 'center', background: 'transparent', border: '1px solid #BA1A1A', color: '#BA1A1A' }}>
            Report No-Show
          </button>
        </div>
      </>, true);

    case 'COMPLETED':
      if (isCitizen && !booking.review) {
        return card(<>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-ox-emerald)' }}>Rate your consultation</h3>
          <p style={{ fontSize: 11, color: 'var(--color-ox-text-muted)', margin: '4px 0 10px' }}>
            Your feedback helps other citizens find good lawyers.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 10 }}>
            {[1,2,3,4,5].map((n) => (
              <button key={n} onClick={() => setReviewRating(n)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <span className="material-symbols-outlined" style={{
                  fontSize: 28, color: n <= reviewRating ? 'var(--color-ox-gold)' : 'var(--color-ox-border)',
                  fontVariationSettings: n <= reviewRating ? "'FILL' 1" : '',
                }}>star</span>
              </button>
            ))}
          </div>
          <textarea className="ox-input" rows={3} placeholder="Optional: share your experience..."
            value={reviewComment} onChange={(e) => setReviewComment(e.target.value)}
            style={{ resize: 'vertical', fontFamily: 'inherit' }} />
          <button disabled={loading} onClick={() => onAction(() => bookingsApi.review(booking.id, reviewRating, reviewComment.trim() || undefined))}
            className="ox-btn ox-btn-primary" style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}>
            Submit Review
          </button>
        </>, true);
      }
      return card(<>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-ox-emerald)' }}>Consultation completed</h3>
        <p style={{ fontSize: 11, color: 'var(--color-ox-text-muted)', marginTop: 4 }}>
          Chat closes {booking.chatClosedAt ? new Date(booking.chatClosedAt).toLocaleTimeString() : 'soon'}.
        </p>
        <button
          type="button"
          onClick={() => navigate(`/consultation/${booking.id}/preflight`)}
          className="ox-btn ox-btn-ghost"
          style={{ marginTop: 8, width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>subtitles</span>
          View transcript &amp; recording
        </button>
      </>);

    case 'RATED':
      return card(<>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-ox-emerald)' }}>Reviewed</h3>
        {booking.review && (
          <>
            <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
              {[1,2,3,4,5].map((n) => (
                <span key={n} className="material-symbols-outlined" style={{
                  fontSize: 16, color: n <= booking.review!.rating ? 'var(--color-ox-gold)' : 'var(--color-ox-border)',
                  fontVariationSettings: n <= booking.review!.rating ? "'FILL' 1" : '',
                }}>star</span>
              ))}
            </div>
            {booking.review.comment && (
              <p style={{ fontSize: 11, color: 'var(--color-ox-text)', marginTop: 6, fontStyle: 'italic' }}>
                "{booking.review.comment}"
              </p>
            )}
          </>
        )}
      </>);

    case 'DECLINED':
    case 'AUTO_CANCELLED':
      return card(<>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#BA1A1A' }}>
          {booking.status === 'DECLINED' ? 'Booking declined' : 'Booking auto-cancelled'}
        </h3>
        <p style={{ fontSize: 11, color: 'var(--color-ox-text-muted)', marginTop: 4 }}>
          {booking.status === 'AUTO_CANCELLED'
            ? 'Payment was not received in time. The slot has been released.'
            : 'The slot has been released. You can book another lawyer or another time.'}
        </p>
        {isCitizen && (
          <button onClick={() => navigate('/lawyers')} className="ox-btn ox-btn-primary"
            style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}>
            Find Another Lawyer
          </button>
        )}
      </>);

    case 'NO_SHOW':
      return card(<>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#BA1A1A' }}>Marked as no-show</h3>
        <p style={{ fontSize: 11, color: 'var(--color-ox-text-muted)', marginTop: 4 }}>
          {booking.noShowParty === 'LAWYER' ? 'The lawyer did not join the session.' : 'The citizen did not join the session.'}
        </p>
      </>);

    default:
      return null;
  }
};