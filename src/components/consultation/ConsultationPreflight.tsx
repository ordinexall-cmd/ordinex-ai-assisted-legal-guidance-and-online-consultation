import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingsApi, type Booking } from '../../services/api';
import { canJoinBookingVideo } from '../../utils/bookingSlotWindow';
import { getErrorMessage } from '../../utils/userFacingError';
import { ReportUserModal } from '../trust/ReportUserModal';
import '../../styles/consultation-chromeless.css';

const consentKey = (bookingId: string) => `ox-consult-consent:${bookingId}`;

export function hasConsultationConsent(bookingId: string): boolean {
  try {
    return sessionStorage.getItem(consentKey(bookingId)) === '1';
  } catch {
    return false;
  }
}

export function setConsultationConsent(bookingId: string) {
  try {
    sessionStorage.setItem(consentKey(bookingId), '1');
  } catch {
    /* private mode */
  }
}

export interface ConsultationPreflightProps {
  readonly bookingId: string;
  readonly backTo: string;
  readonly userEmail?: string | null;
  readonly onProceed: (booking: Booking) => void;
}

function ChecklistItem({
  icon,
  title,
  children,
  badge,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="consult-preflight-card__item">
      <span className="consult-preflight-card__icon material-symbols-outlined" aria-hidden>{icon}</span>
      <div className="consult-preflight-card__item-body">
        <div className="consult-preflight-card__item-head">
          <h3>{title}</h3>
          {badge}
        </div>
        <div className="consult-preflight-card__item-text">{children}</div>
      </div>
    </div>
  );
}

export const ConsultationPreflight: React.FC<ConsultationPreflightProps> = ({
  bookingId,
  backTo,
  onProceed,
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deviceOk, setDeviceOk] = useState<boolean | null>(null);
  const [networkOk, setNetworkOk] = useState<boolean | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [showReport, setShowReport] = useState(false);

  const fetchBooking = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { booking: b } = await bookingsApi.getById(bookingId);
      if (!['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'RATED'].includes(b.status)) {
        setError(`This consultation is not ready for video (status: ${b.status.replace(/_/g, ' ')}).`);
        setBooking(null);
      } else if (
        ['CONFIRMED', 'IN_PROGRESS'].includes(b.status) &&
        !canJoinBookingVideo(b.availability, b.status, new Date(), false, b.joinExtendedUntil)
      ) {
        setError('Video consultation is not open yet. Check the scheduled time on your booking page.');
        setBooking(b);
      } else {
        setBooking(b);
      }
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Could not load consultation.'));
      setBooking(null);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    void fetchBooking();
  }, [fetchBooking]);

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setDeviceOk(false);
      return;
    }
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
        if (!cancelled) setDeviceOk(true);
      })
      .catch(() => {
        if (!cancelled) setDeviceOk(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setNetworkOk(null);
      try {
        const t0 = performance.now();
        const res = await fetch(`/api/bookings/${bookingId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('ordinex_token') || ''}`,
          },
          cache: 'no-store',
        });
        const ms = Math.round(performance.now() - t0);
        if (cancelled) return;
        setLatencyMs(ms);
        setNetworkOk(res.ok && ms < 2500);
      } catch {
        if (!cancelled) {
          setNetworkOk(false);
          setLatencyMs(null);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const peerName =
    booking && booking.viewerRole === 'CITIZEN' ? booking.lawyer.name : booking?.citizen.name;
  const reportedUserId =
    booking && booking.viewerRole === 'CITIZEN' ? booking.lawyer.id : booking?.citizen.id;

  const canEnterLive =
    booking &&
    ['CONFIRMED', 'IN_PROGRESS'].includes(booking.status) &&
    canJoinBookingVideo(
      booking.availability,
      booking.status,
      new Date(),
      false,
      booking.joinExtendedUntil,
    );

  const isReviewOnly =
    booking && ['COMPLETED', 'RATED'].includes(booking.status);

  const proceed = async () => {
    if (!booking) return;
    if (isReviewOnly) {
      setConsultationConsent(bookingId);
      onProceed(booking);
      return;
    }
    if (!agreed || deviceOk !== true || networkOk === false || !canEnterLive) return;
    try {
      await bookingsApi.consultConsent(bookingId);
      setConsultationConsent(bookingId);
      onProceed(booking);
    } catch (e) {
      setError(getErrorMessage(e, 'Could not save consent. Please try again.'));
    }
  };

  const networkBadge =
    networkOk === true ? (
      <span className="consult-preflight__device consult-preflight__device--ok">
        {latencyMs != null ? `${latencyMs} ms` : 'OK'}
      </span>
    ) : networkOk === null ? (
      <span className="consult-preflight__device consult-preflight__device--wait">Checking…</span>
    ) : (
      <span className="consult-preflight__device consult-preflight__device--fail">Unstable</span>
    );

  const deviceBadge =
    deviceOk === true ? (
      <span className="consult-preflight__device consult-preflight__device--ok">Ready</span>
    ) : deviceOk === null ? (
      <span className="consult-preflight__device consult-preflight__device--wait">Checking…</span>
    ) : (
      <span className="consult-preflight__device consult-preflight__device--fail">Access needed</span>
    );

  if (loading) {
    return (
      <div className="consult-chromeless consult-chromeless--center">
        <p className="consult-chromeless__muted">Checking devices…</p>
      </div>
    );
  }

  return (
    <div className="consult-chromeless">
      <header className="consult-chromeless__header">
        <button
          type="button"
          className="consult-chromeless__back"
          onClick={() => navigate(backTo)}
          aria-label="Back"
        >
          ←
        </button>
        <div className="consult-chromeless__header-main">
          <div className="consult-chromeless__title">Before you join</div>
          {peerName && (
            <div className="consult-chromeless__subtitle">With {peerName}</div>
          )}
        </div>
        {booking && reportedUserId && (
          <button type="button" className="consult-chromeless__btn" onClick={() => setShowReport(true)}>
            Report issue
          </button>
        )}
      </header>

      <main className="consult-preflight consult-preflight--centered">
        {error && !isReviewOnly ? (
          <div className="consult-preflight-card">
            <div className="consult-preflight__error">{error}</div>
            <div className="consult-preflight-card__actions">
              <button type="button" className="consult-chromeless__btn consult-chromeless__btn--primary" onClick={() => navigate(`/booking/${bookingId}`)}>
                Open booking
              </button>
              <button type="button" className="consult-chromeless__btn" onClick={() => { void fetchBooking(); }}>
                Retry
              </button>
            </div>
          </div>
        ) : (
          <div className="consult-preflight-card">
            <p className="consult-preflight-card__intro">
              Private consultation with an independent licensed lawyer on Ordinex — not a PAO session.
              Prior AI analysis on Ordinex is <strong>pre-guidance only</strong> and does not replace this lawyer&apos;s advice.
            </p>

            {!isReviewOnly && (
              <ChecklistItem icon="videocam" title="Camera &amp; microphone" badge={deviceBadge}>
                {deviceOk === null && 'Checking camera and microphone…'}
                {deviceOk === true && 'Camera and microphone are available. Keep them on during the consultation unless you mute temporarily.'}
                {deviceOk === false && 'Allow camera and microphone in your browser settings, then refresh.'}
              </ChecklistItem>
            )}

            {!isReviewOnly && (
              <ChecklistItem icon="wifi" title="Connection" badge={networkBadge}>
                {networkOk === null && 'Measuring connection to Ordinex…'}
                {networkOk === true && 'Connection looks usable for video.'}
                {networkOk === false && 'Network looks slow or offline. Switch Wi‑Fi / mobile data, then retry.'}
              </ChecklistItem>
            )}

            <ChecklistItem icon="shield" title="Security">
              <ul>
                <li>This call uses an encrypted connection between you and Ordinex.</li>
                <li>Do not share your login, OTP, or screen with third parties during the session.</li>
                <li>Report suspicious behaviour using Report issue in the header.</li>
              </ul>
            </ChecklistItem>

            <ChecklistItem icon="lock" title="Confidentiality">
              <p>
                This session is confidential between you and your lawyer, subject to attorney–client privilege.
                Do not share login access or stream this call to third parties. See our{' '}
                <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>
                {' '}and{' '}
                <a href="/terms" target="_blank" rel="noreferrer">Terms of Service</a>.
              </p>
            </ChecklistItem>

            <ChecklistItem icon="fiber_manual_record" title="Recording &amp; transcript">
              <ul>
                <li>The lawyer&apos;s session recording is the canonical record when both sides record.</li>
                <li>Your local copy is a personal fallback only — do not redistribute.</li>
                <li>Live speech text is approximate (English, Tagalog, Cebuano), not a verbatim official record.</li>
              </ul>
            </ChecklistItem>

            <ChecklistItem icon="info" title="What to expect">
              <ul>
                <li>Live transcript during the call (short delay).</li>
                <li>Recording download after you end the session.</li>
                <li>Editable transcript on the booking page when the session ends.</li>
              </ul>
            </ChecklistItem>

            <footer className="consult-preflight-card__footer">
              {isReviewOnly ? (
                <button type="button" className="consult-preflight__proceed" onClick={proceed}>
                  View transcript &amp; recording
                </button>
              ) : (
                <>
                  <label className="consult-preflight__agree">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                    />
                    <span>
                      I agree to the{' '}
                      <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>
                      {' '}and{' '}
                      <a href="/terms" target="_blank" rel="noreferrer">Terms</a>
                      ; I consent to recording and transcript processing; and I will keep camera and microphone available for this consultation.
                    </span>
                  </label>
                  <button
                    type="button"
                    className="consult-preflight__proceed"
                    disabled={!agreed || deviceOk !== true || networkOk === false || !canEnterLive}
                    onClick={proceed}
                  >
                    Join consultation
                  </button>
                </>
              )}
            </footer>
          </div>
        )}
      </main>

      {showReport && booking && reportedUserId && (
        <ReportUserModal
          reportedUserId={reportedUserId}
          reportedUserName={peerName || 'participant'}
          bookingId={booking.id}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
};

export default ConsultationPreflight;
