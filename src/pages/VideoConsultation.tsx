import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/shell/AppShell';
import { LegacyVideoConsultRedirect } from '../routes/LegacyVideoConsultRedirect';
import { useAuth } from '../context/AuthContext';
import { bookingsApi, type Booking } from '../services/api';
import { getCitizenNav } from '../utils/citizenWorkspace';
import { lawyerNav } from '../utils/lawyerWorkspace';
import { ApiLoadBanner } from '../components/ui/ApiLoadBanner';
import { loadErrorMessage } from '../utils/loadErrorMessage';
import { statusChipClass, statusChipLabel } from '../utils/bookingStatusChip';
import { canJoinBookingVideo } from '../utils/bookingSlotWindow';
import { getAppBackFallback } from '../utils/navigation';

/** Video consultation lobby — lists confirmed sessions. Sessions use /consultation/:id/preflight. */
const VideoConsultation: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Booking[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [sessionsLoadError, setSessionsLoadError] = useState('');
  const [lobbyClock, setLobbyClock] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setLobbyClock((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const loadSessions = useCallback(() => {
    if (!user) return;
    setListLoading(true);
    setSessionsLoadError('');
    bookingsApi.getMy({ limit: 50 })
      .then(({ bookings }) => {
        setSessions(bookings.filter((b) => ['CONFIRMED', 'IN_PROGRESS'].includes(b.status)));
      })
      .catch((e) => {
        setSessions([]);
        setSessionsLoadError(loadErrorMessage(e, 'Could not load video sessions.'));
      })
      .finally(() => setListLoading(false));
  }, [user]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  if (!user) return <Navigate to="/" replace />;

  const isLawyer = user.role === 'LAWYER';
  const nav = isLawyer ? lawyerNav : getCitizenNav();
  const backTo = getAppBackFallback(isLawyer);

  return (
    <>
      <LegacyVideoConsultRedirect />
      <AppShell
        variant="flow"
        title="Video consultation"
        navItems={nav}
        stepLabel="Lobby"
        backTo={backTo}
      >
        <div className="staff-workspace marketplace">
          <p className="staff-empty-hint" style={{ marginBottom: '0.85rem' }}>
            {isLawyer
              ? 'Join confirmed private consultations. You will confirm recording policy before entering.'
              : 'Join after your booking is confirmed. Consent is required before video starts.'}
          </p>

          {sessionsLoadError && (
            <ApiLoadBanner message={sessionsLoadError} onRetry={loadSessions} />
          )}

          {listLoading ? (
            <p className="staff-empty-hint">Loading sessions…</p>
          ) : sessions.length === 0 && !sessionsLoadError ? (
            <div className="staff-panel marketplace-empty">
              <span className="material-symbols-outlined marketplace-empty__icon" aria-hidden>videocam_off</span>
              <h3>No confirmed sessions yet</h3>
              <p>
                {isLawyer
                  ? 'When a client booking is confirmed, it will appear here.'
                  : 'Book a lawyer from the directory, then join from here or the booking page.'}
              </p>
              {!isLawyer && (
                <Link to="/lawyers" className="ox-btn ox-btn-primary" style={{ marginTop: 12 }}>
                  Browse lawyers
                </Link>
              )}
            </div>
          ) : (
            <div className="staff-panel">
              <h2 className="staff-panel__title">Upcoming sessions</h2>
              {sessions.map((b) => {
                const peer = b.viewerRole === 'CITIZEN' ? b.lawyer.name : b.citizen.name;
                const when = new Date(b.availability.date).toLocaleDateString('en-PH', {
                  weekday: 'short', month: 'short', day: 'numeric',
                });
                const joinOk = canJoinBookingVideo(b.availability, b.status, new Date());
                void lobbyClock;
                return (
                  <div key={b.id} className="marketplace-session-row">
                    <div>
                      <p className="marketplace-session-row__name">{peer}</p>
                      <p className="marketplace-session-row__meta">
                        {when} · {b.availability.startTime}–{b.availability.endTime}
                      </p>
                      <span className={statusChipClass(b.status)}>{statusChipLabel(b.status)}</span>
                    </div>
                    <button
                      type="button"
                      className="ox-btn ox-btn-primary ox-btn-sm"
                      disabled={!joinOk}
                      title={joinOk ? undefined : 'Available only during the scheduled time'}
                      onClick={() => {
                        if (joinOk) navigate(`/consultation/${b.id}/preflight`);
                      }}
                    >
                      Join
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </AppShell>
    </>
  );
};

export default VideoConsultation;
