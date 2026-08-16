import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useBookingDock } from '../context/BookingDockContext';
import { isDockableBooking } from '../utils/dockableBooking';
import { BookingTranscriptPanel } from '../components/booking/BookingTranscriptPanel';
import { VideoStage } from '../components/video/VideoStage';
import { ConsultationPostCall } from '../components/consultation/ConsultationPostCall';
import { ReportUserModal } from '../components/trust/ReportUserModal';
import { useAuth } from '../context/AuthContext';
import { bookingsApi, type Booking } from '../services/api';
import { onBookingUpdated } from '../services/appSocket';
import { getErrorMessage } from '../utils/userFacingError';
import { statusChipLabel } from '../utils/bookingStatusChip';
import { useBookingSlotWindow } from '../hooks/useBookingSlotWindow';
import { canJoinBookingVideo } from '../utils/bookingSlotWindow';
import { hasConsultationConsent } from '../components/consultation/ConsultationPreflight';
import { Modal } from '../components/ui/Modal';
import '../styles/consultation-chromeless.css';

const canEnterSession = (s: Booking['status']) =>
  s === 'CONFIRMED' || s === 'IN_PROGRESS' || s === 'COMPLETED' || s === 'RATED';

export const VideoConsultationSession: React.FC = () => {
  const { id: bookingId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [postCall, setPostCall] = useState(false);
  const [uploadingRec, setUploadingRec] = useState(false);
  const [showTranscript, setShowTranscript] = useState(true);
  const [showReport, setShowReport] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const bookingDock = useBookingDock();
  const dockOpenedForBooking = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    setErr(null);
    try {
      const { booking: b } = await bookingsApi.getById(bookingId);
      setBooking(b);
    } catch (e: unknown) {
      setErr(getErrorMessage(e, 'Could not load booking.'));
      setBooking(null);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    if (!bookingId) return;
    void load();
  }, [bookingId, load]);

  useEffect(() => {
    if (!bookingId) return;
    return onBookingUpdated((p) => {
      if (p.bookingId === bookingId) void load();
    });
  }, [bookingId, load]);

  useEffect(() => {
    if (!bookingId || !booking || !isDockableBooking(booking) || postCall) return;
    if (dockOpenedForBooking.current === bookingId) return;
    dockOpenedForBooking.current = bookingId;
    bookingDock.openBooking(bookingId, { expand: false });
  }, [bookingId, booking?.id, bookingDock, postCall]);

  const slotWindow = useBookingSlotWindow(booking?.availability, booking?.status);

  useEffect(() => {
    if (!bookingId || !booking || postCall) return;
    if (booking.status !== 'CONFIRMED') return;
    if (!canJoinBookingVideo(booking.availability, booking.status, new Date())) return;
    let cancelled = false;
    (async () => {
      try {
        const { booking: updated } = await bookingsApi.startSession(bookingId);
        if (!cancelled) setBooking(updated);
      } catch {
        try {
          const { booking: b2 } = await bookingsApi.getById(bookingId);
          if (!cancelled) setBooking(b2);
        } catch { /* ignore */ }
      }
    })();
    return () => { cancelled = true; };
  }, [bookingId, booking?.status, booking?.availability, postCall]);

  const handleEndCall = async () => {
    if (!bookingId || !booking) return;
    setUploadingRec(true);
    const isLawyerUser = user?.role === 'LAWYER';
    if (booking.status === 'IN_PROGRESS' || booking.status === 'CONFIRMED') {
      try {
        if (isLawyerUser) {
          // Lawyer closing the live session also closes the case and releases held funds
          const { booking: b } = await bookingsApi.complete(bookingId);
          setBooking(b);
        }
        // Citizens end the call without releasing payment — lawyer closes case separately
      } catch { /* show post-call anyway */ }
    }
    try {
      const { booking: fresh } = await bookingsApi.getById(bookingId);
      setBooking(fresh);
    } catch { /* keep current */ }
    setUploadingRec(false);
    setPostCall(true);
  };

  if (!user) return <Navigate to="/" replace />;
  if (!bookingId) return <Navigate to="/consultation/video" replace />;

  const isReviewOnly = booking && (booking.status === 'COMPLETED' || booking.status === 'RATED');
  const needsConsent =
    booking &&
    !isReviewOnly &&
    ['CONFIRMED', 'IN_PROGRESS'].includes(booking.status) &&
    !hasConsultationConsent(bookingId);

  if (!loading && !err && booking && needsConsent) {
    return <Navigate to={`/consultation/${bookingId}/preflight`} replace />;
  }

  const isLawyer = user.role === 'LAWYER';
  const backTo = isLawyer ? '/lawyer/dashboard' : '/dashboard';
  const peerName =
    booking && booking.viewerRole === 'CITIZEN' ? booking.lawyer.name : booking?.citizen.name;
  const selfLabel = user.name?.split(' ')[0] || 'You';
  const role = booking?.viewerRole === 'LAWYER' ? 'lawyer' : 'citizen';
  const reportedUserId =
    booking && booking.viewerRole === 'CITIZEN' ? booking.lawyer.id : booking?.citizen.id;
  const reportedUserName = peerName || 'participant';

  if (loading) {
    return (
      <div className="consult-chromeless consult-chromeless--center">
        <p className="consult-chromeless__muted">Loading session…</p>
      </div>
    );
  }

  if (postCall && booking) {
    return (
      <>
        <ConsultationPostCall
          booking={booking}
          uploading={uploadingRec}
          onOpenBooking={() => navigate(`/booking/${bookingId}`)}
          onBack={() => navigate(backTo)}
          onReport={() => setShowReport(true)}
        />
        {showReport && reportedUserId && (
          <ReportUserModal
            reportedUserId={reportedUserId}
            reportedUserName={reportedUserName}
            bookingId={booking.id}
            onClose={() => setShowReport(false)}
          />
        )}
      </>
    );
  }

  const liveOk =
    booking &&
    canEnterSession(booking.status) &&
    (slotWindow.canJoinVideo || booking.status === 'COMPLETED' || booking.status === 'RATED');

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
          <div className="consult-chromeless__title">Private video consultation</div>
          <div className="consult-chromeless__subtitle">
            {peerName ? `With ${peerName}` : 'Video'}
            {booking ? ` · ${statusChipLabel(booking.status)}` : ''}
          </div>
        </div>
        <div className="consult-chromeless__header-actions">
          <button
            type="button"
            className="consult-chromeless__btn"
            onClick={() => setShowTranscript((v) => !v)}
          >
            {showTranscript ? 'Hide' : 'Show'} transcript
          </button>
          {booking && reportedUserId && (
            <button type="button" className="consult-chromeless__btn" onClick={() => setShowReport(true)}>
              Report
            </button>
          )}
          <button
            type="button"
            className="consult-chromeless__btn"
            onClick={() => navigate(`/booking/${bookingId}`)}
          >
            Booking
          </button>
          {booking && ['CONFIRMED', 'IN_PROGRESS'].includes(booking.status) && (
            <button
              type="button"
              className="consult-chromeless__btn consult-chromeless__btn--end"
              onClick={() => setShowEndModal(true)}
            >
              End session
            </button>
          )}
        </div>
      </header>

      {err && (
        <div className="consult-preflight" style={{ paddingTop: '1rem' }}>
          <div className="consult-preflight__error">{err}</div>
          <Link to={`/consultation/${bookingId}/preflight`} className="consult-chromeless__btn consult-chromeless__btn--primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
            Back to consent
          </Link>
        </div>
      )}

      {!err && booking && !canEnterSession(booking.status) && (
        <div className="consult-room__gate">
          <h3>Not ready for video</h3>
          <p>This booking is not ready for video (status: {booking.status}).</p>
          <button type="button" className="consult-chromeless__btn consult-chromeless__btn--primary" onClick={() => navigate(`/booking/${bookingId}`)}>
            Open booking
          </button>
        </div>
      )}

      {!err && booking && canEnterSession(booking.status) && !slotWindow.canJoinVideo && booking.status === 'CONFIRMED' && (
        <div className="consult-room__gate">
          <h3>Waiting for slot time</h3>
          <p>{slotWindow.hint}</p>
          <button type="button" className="consult-chromeless__btn consult-chromeless__btn--primary" onClick={() => navigate(`/booking/${bookingId}`)}>
            Back to booking
          </button>
        </div>
      )}

      {!err && liveOk && booking && (
        <div className={`consult-room${showTranscript ? ' consult-room--transcript' : ''}`}>
          <div className="consult-room__stage">
            {(booking.status === 'COMPLETED' || booking.status === 'RATED') ? (
              <div className="consult-room__gate">
                <h3>Consultation ended</h3>
                <p>View the transcript and recording below, or open the booking.</p>
                <button type="button" className="consult-chromeless__btn consult-chromeless__btn--primary" onClick={() => navigate(`/booking/${bookingId}`)}>
                  Open booking
                </button>
              </div>
            ) : (
              <VideoStage
                booking={booking}
                role={role as 'citizen' | 'lawyer'}
                peerName={peerName || ''}
                selfLabel={selfLabel}
                autoStartRecording
                onOpenChat={() => bookingDock.openBooking(booking.id, { expand: true })}
                onEndCall={() => setShowEndModal(true)}
                onRecordingUploadDone={(url) => {
                  if (url) setBooking((prev) => (prev ? { ...prev, recordingUrl: url } : prev));
                }}
              />
            )}
          </div>

          {showTranscript && (
            <aside className="consult-room__transcript">
              <div className="consult-room__transcript-inner">
                <BookingTranscriptPanel
                  bookingId={booking.id}
                  status={booking.status}
                  userLanguage={user.language}
                  recordingUrl={booking.recordingUrl}
                  liveEnabled
                />
              </div>
              <p className="consult-room__transcript-foot">
                Approximate live text. English, Tagalog, and Cebuano. Not a verbatim official record.
              </p>
            </aside>
          )}
        </div>
      )}

      {showReport && booking && reportedUserId && (
        <ReportUserModal
          reportedUserId={reportedUserId}
          reportedUserName={reportedUserName}
          bookingId={booking.id}
          onClose={() => setShowReport(false)}
        />
      )}

      {showEndModal && (
        <Modal
          open={showEndModal}
          onClose={() => setShowEndModal(false)}
          title="End consultation session?"
          size="sm"
        >
          <div style={{ padding: '0.5rem 0' }}>
            <p style={{ color: '#334155', lineHeight: 1.5, marginBottom: '1.25rem' }}>
              {user.role === 'LAWYER'
                ? 'Ending the session will mark this consultation as complete, upload the session recording/transcript, and credit the consultation fee to your wallet.'
                : 'Are you sure you want to exit the video consultation? You will still be able to review the transcript and recording in your booking history.'}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="ox-btn ox-btn-outline"
                onClick={() => setShowEndModal(false)}
              >
                Keep session open
              </button>
              <button
                type="button"
                className="ox-btn ox-btn-primary"
                style={{ background: '#b91c1c', borderColor: '#b91c1c' }}
                onClick={() => {
                  setShowEndModal(false);
                  void handleEndCall();
                }}
              >
                End consultation
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default VideoConsultationSession;
