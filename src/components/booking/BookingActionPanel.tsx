import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingsApi, type Booking } from '../../services/api';
import { useBookingSlotWindow } from '../../hooks/useBookingSlotWindow';
import { BookingPaymentStepper } from './BookingPaymentStepper';
import { JoinVideoButton } from './JoinVideoButton';
import { BookingRescheduleModal } from './BookingRescheduleModal';

const peso = (n: number | null | undefined) =>
  (n == null ? 'Ask' : n === 0 ? 'Free' : `₱${n.toLocaleString()}`);

const COMMISSION_RATE = 0.15;

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
  const [showReschedule, setShowReschedule] = useState(false);
  const dutyStart = booking.dutyWindow?.startTime || booking.availability.startTime;
  const dutyEnd = booking.dutyWindow?.endTime || booking.availability.endTime;
  const [sessionStart, setSessionStart] = useState(
    booking.sessionStartTime || booking.preferredStartTime || booking.availability.startTime,
  );
  const [sessionEnd, setSessionEnd] = useState(
    booking.sessionEndTime || booking.availability.endTime,
  );

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

  const slotWindow = useBookingSlotWindow(
    booking.availability,
    booking.status,
    false,
    booking.joinExtendedUntil,
  );

  const showJoinActions = Boolean(
    booking.awaitingJoinActionAt
    || (booking.status === 'CONFIRMED' && slotWindow.phase === 'after' && !slotWindow.canJoinVideo),
  );

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
                You asked for {booking.preferredStartTime || booking.availability.startTime}.
                That hour is held so nobody else can take it. You&apos;ll get a notification when they approve the exact time and fee.
              </p>
            </div>
          </div>
        ) : (
          <>
            {actionTitle('New booking request')}
            {actionText(
              <>
                Preferred start: <strong>{booking.preferredStartTime || booking.availability.startTime}</strong>
                {' '}inside {dutyStart}–{dutyEnd}. Set the exact session range and fee.
              </>,
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

            <div className="quote-input-section">
              <p className="quote-input-section__title">Session time</p>
              <div className="quote-input-row" style={{ gap: 8 }}>
                <input
                  className="ox-input"
                  type="time"
                  min={dutyStart}
                  max={dutyEnd}
                  value={sessionStart}
                  onChange={(e) => setSessionStart(e.target.value)}
                  aria-label="Session start"
                />
                <input
                  className="ox-input"
                  type="time"
                  min={dutyStart}
                  max={dutyEnd}
                  value={sessionEnd}
                  onChange={(e) => setSessionEnd(e.target.value)}
                  aria-label="Session end"
                />
              </div>
              <p className="quote-input-section__hint">
                Must stay inside {dutyStart}–{dutyEnd} and not overlap another booking.
              </p>
            </div>

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
                      <span>Ordinex service fee (15%)</span>
                      <span>−{peso(platformFee)}</span>
                    </div>
                    <div className="quote-breakdown__row">
                      <span>You receive (85%)</span>
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
                disabled={loading || !sessionStart || !sessionEnd || (isPaidLawyer && (!isQuoteValid || parsedQuotedFee <= 0))}
                onClick={() => {
                  onAction(() => bookingsApi.approve(
                    booking.id,
                    isPaidLawyer ? parsedQuotedFee : undefined,
                    undefined,
                    { sessionStartTime: sessionStart, sessionEndTime: sessionEnd },
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
            Session: <strong>{booking.availability.startTime}–{booking.availability.endTime}</strong>.
            Quoted fee: <strong>{peso(booking.quotedFee)}</strong>.
            The citizen has 24 hours to pay in Ordinex (PayMongo/GCash). Do not collect GCash on a personal wallet.
            {booking.approvedAt && (
              <> Expires {new Date(new Date(booking.approvedAt).getTime() + 24 * 60 * 60 * 1000).toLocaleString()}.</>
            )}
          </>)}
        </>);
      }
      return card(<>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-ox-emerald)' }}>
          Approved! Confirm this time and complete payment.
        </h3>
        <div style={{ fontSize: 11, color: 'var(--color-ox-text-muted)', margin: '4px 0 10px' }}>
          <p style={{ margin: '4px 0', fontWeight: 600 }}>
            {booking.availability.startTime}–{booking.availability.endTime}
          </p>
          <div className="quote-breakdown" style={{ marginTop: 8, marginBottom: 8 }}>
            <div className="quote-breakdown__row quote-breakdown__row--total">
              <span>Consultation fee</span>
              <span>{peso(booking.quotedFee)}</span>
            </div>
          </div>
          <p style={{ margin: '4px 0', fontSize: 11, color: 'var(--color-ox-brand)', fontWeight: 500 }}>
            Pay only through Ordinex. Do not send GCash to the lawyer directly. Funds are held until the session ends; 15% is the platform fee.
          </p>
          <p style={{ margin: '4px 0', fontSize: 10, color: 'var(--color-ox-text-muted)' }}>
            Complete PayMongo/GCash checkout within 24 hours or the slot will be released.
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
        {actionTitle('Ready to consult')}
        <JoinVideoButton
          bookingId={booking.id}
          canJoin={slotWindow.canJoinVideo}
          hint={slotWindow.hint}
        />
        {showJoinActions && (
          <div className="booking-join-actions" role="region" aria-label="Consultation options">
            <p className="booking-join-actions__text" role="status">
              Nobody joined on time. Continue waiting if the lawyer is free, reschedule, or cancel for a refund.
            </p>
            <div className="booking-join-actions__buttons">
              <button
                type="button"
                className="ox-btn ox-btn-secondary booking-join-actions__btn"
                disabled={loading || !booking.canContinueWaiting}
                title={booking.canContinueWaiting ? undefined : 'The lawyer has another session scheduled soon.'}
                onClick={() => onAction(() => bookingsApi.continueWaiting(booking.id))}
              >
                Continue waiting
              </button>
              <button
                type="button"
                className="ox-btn ox-btn-secondary booking-join-actions__btn"
                disabled={loading}
                onClick={() => setShowReschedule(true)}
              >
                Reschedule
              </button>
              <button
                type="button"
                className="ox-btn booking-join-actions__btn"
                disabled={loading}
                onClick={() => onAction(() => bookingsApi.cancelRefund(booking.id))}
              >
                Cancel &amp; refund
              </button>
            </div>
          </div>
        )}
        {!showJoinActions && (
          <div className="booking-action-card__footer booking-action-card__footer--inline">
            {isLawyer && (
              <button
                type="button"
                disabled={loading}
                onClick={() => onAction(() => bookingsApi.complete(booking.id))}
                className="ox-btn ox-btn-secondary booking-action-card__btn"
              >
                Close case & release payment
              </button>
            )}
            {!isLawyer && (
              <p className="booking-action-card__note">
                Your payment stays held until the lawyer closes the case after the consultation.
              </p>
            )}
            <button
              type="button"
              disabled={loading}
              onClick={() => onAction(() => bookingsApi.cancelRefund(booking.id))}
              className="ox-btn booking-action-card__btn"
            >
              Cancel & refund
            </button>
          </div>
        )}
        {showReschedule && (
          <BookingRescheduleModal
            booking={booking}
            onClose={() => setShowReschedule(false)}
            onRescheduled={(updated) => {
              setShowReschedule(false);
              onAction(async () => ({ booking: updated }));
            }}
          />
        )}
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
          <button onClick={() => navigate('/directory')} className="ox-btn ox-btn-primary"
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