import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/shell/AppShell';
import { useAuth } from '../context/AuthContext';
import { bookingsApi, briefsApi, type Booking, type LawyerBriefOffer } from '../services/api';
import { onBookingUpdated, onNotificationNew } from '../services/appSocket';
import { displayFirstName } from '../utils/displayName';
import { getLawyerNav } from '../utils/lawyerWorkspace';
import { ApiLoadBanner } from '../components/ui/ApiLoadBanner';
import { getErrorMessage } from '../utils/userFacingError';
import { loadErrorMessage } from '../utils/loadErrorMessage';
import StaffListPreview from '../components/staff/StaffListPreview';
import { statusChipLabel } from '../utils/bookingStatusChip';
import { canJoinBookingVideo } from '../utils/bookingSlotWindow';
import { DashWelcome } from '../components/dashboard/DashWelcome';
import { DashHistorySkeleton } from '../components/dashboard/DashHistorySkeleton';
import { OxStatusCallout } from '../components/ui/OxStatusCallout';

const fmtSlot = (b: Booking) => {
  const dateStr = new Date(b.availability.date).toLocaleDateString('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
  return `${dateStr} · ${b.availability.startTime}–${b.availability.endTime}`;
};

export const LawyerDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [offers, setOffers] = useState<LawyerBriefOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [loadError, setLoadError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setLoadError('');
    Promise.all([
      bookingsApi.getMy({ limit: 100 }),
      briefsApi.myOffers().catch(() => ({ offers: [] as LawyerBriefOffer[] })),
    ])
      .then(([r, o]) => {
        setBookings(r.bookings);
        setOffers(o.offers);
      })
      .catch((e) => {
        setBookings([]);
        setOffers([]);
        setLoadError(loadErrorMessage(e, 'Could not load bookings.'));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => onBookingUpdated(() => load()), [load]);
  useEffect(() => onNotificationNew(() => load()), [load]);

  useEffect(() => {
    if (loading) return;
    const id = location.hash.replace('#', '');
    if (!id) return;
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(t);
  }, [location.hash, location.state, loading]);

  const pending = useMemo(() => bookings.filter((b) => b.status === 'REQUESTED'), [bookings]);
  const paymentsToVerify = useMemo(
    () => bookings.filter((b) => b.status === 'PAYMENT_SUBMITTED'),
    [bookings],
  );
  const todayKey = new Date().toISOString().slice(0, 10);
  const todaySessions = useMemo(
    () => bookings.filter(
      (b) =>
        ['CONFIRMED', 'IN_PROGRESS', 'APPROVED'].includes(b.status) &&
        b.availability.date.slice(0, 10) === todayKey,
    ),
    [bookings, todayKey],
  );
  const completed = useMemo(
    () => bookings.filter((b) => b.status === 'COMPLETED' || b.status === 'RATED'),
    [bookings],
  );

  const onAction = async (id: string, fn: () => Promise<unknown>) => {
    setActing(id);
    setActionError('');
    try {
      await fn();
      load();
    } catch (e: unknown) {
      setActionError(getErrorMessage(e, 'Action failed. Please try again.'));
    } finally {
      setActing(null);
    }
  };

  const userName = displayFirstName(user?.name, 'Atty.');

  return (
    <AppShell title="Dashboard" navItems={getLawyerNav(user)} hidePageHeader>
      <div className="dash-layout dash-layout--premium">
        <DashWelcome
          userName={userName}
          subtitle="Review booking requests, confirm payments, and join today's sessions."
        />

        {user?.isVerified ? (
          <OxStatusCallout
            variant="verify"
            icon="verified"
            title="Verified counsel — listed on the lawyer directory"
            action={(
              <button
                type="button"
                className="ox-btn ox-btn-secondary ox-btn-sm"
                onClick={() => navigate('/settings?tab=verification')}
              >
                View bar credentials
              </button>
            )}
          >
            <p>
              {[
                user.barNumber ? `SC Roll No. ${user.barNumber}` : null,
                user.ibpChapter ? `IBP ${user.ibpChapter}` : null,
                user.ptrNumber ? `PTR ${user.ptrNumber}` : null,
                user.mcleComplianceNo ? `MCLE ${user.mcleComplianceNo}` : null,
              ].filter(Boolean).join(' · ') || 'Your verification is on file in Account Settings.'}
            </p>
          </OxStatusCallout>
        ) : (
          <OxStatusCallout
            variant="warn"
            title="Bar verification required"
            action={(
              <button
                type="button"
                className="ox-btn ox-btn-primary ox-btn-sm"
                onClick={() => navigate('/settings?tab=verification')}
              >
                Complete bar verification
              </button>
            )}
          >
            <p>
              Your profile stays hidden from the public directory and cannot accept bookings until Supreme Court Roll and bar credentials are verified.
            </p>
            <ul className="ox-callout__checks">
              <li>{user?.barNumber ? 'Provided' : 'Pending'} — Supreme Court Roll No.</li>
              <li>{user?.ibpChapter ? 'Provided' : 'Pending'} — IBP Chapter & ID</li>
              <li>{user?.ptrNumber ? 'Provided' : 'Pending'} — PTR (Professional Tax Receipt)</li>
              <li>{user?.mcleComplianceNo ? 'Provided' : 'Pending'} — MCLE Compliance</li>
            </ul>
          </OxStatusCallout>
        )}

        {loadError && <ApiLoadBanner message={loadError} onRetry={load} />}
        {actionError && <div className="staff-alert staff-alert--error" role="alert">{actionError}</div>}

        {loading ? (
          <DashHistorySkeleton label="Loading dashboard" />
        ) : (
          <>
            <p className="acct-stat-line">
              <span><strong>{pending.length}</strong> pending</span>
              <span><strong>{paymentsToVerify.length}</strong> payments</span>
              <span><strong>{todaySessions.length}</strong> today</span>
              <span><strong>{completed.length}</strong> completed</span>
            </p>

            <div className="acct-section" id="offers" style={{ marginBottom: '0.75rem' }}>
              <div className="acct-section__head">
                <h3 className="acct-section__title">Your consult offers</h3>
                <span className="acct-section__count">{offers.length}</span>
              </div>
              <div className="acct-section__body">
                {offers.length === 0 ? (
                  <p className="acct-empty">No consult offers sent yet.</p>
                ) : (
                  offers.slice(0, 8).map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className="acct-row acct-row--clickable"
                      onClick={() => navigate(`/directory/requests/${o.brief.id}`)}
                    >
                      <div className="acct-row__main">
                        <p className="acct-row__title">{o.brief.displayName}</p>
                        <p className="acct-row__meta">
                          {o.status.replace(/_/g, ' ')} · {o.brief.summary.slice(0, 90)}
                          {o.brief.summary.length > 90 ? '…' : ''}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="staff-page-grid staff-page-grid--2" style={{ marginBottom: '0.75rem' }}>
              <div className="acct-section">
                <div className="acct-section__head">
                  <h3 className="acct-section__title">Pending approvals</h3>
                  <span className="acct-section__count">{pending.length}</span>
                </div>
                <div className="acct-section__body">
                  {pending.length === 0 ? (
                    <p className="acct-empty">No booking requests waiting.</p>
                  ) : (
                    pending.slice(0, 5).map((b) => (
                      <article key={b.id} className="acct-row">
                        <div className="acct-row__main">
                          <p className="acct-row__title">{b.citizen.name}</p>
                          <p className="acct-row__meta">{fmtSlot(b)}</p>
                          {b.caseDescription && (
                            <p className="acct-row__meta">
                              {b.caseDescription.slice(0, 120)}{b.caseDescription.length > 120 ? '…' : ''}
                            </p>
                          )}
                        </div>
                        <div className="acct-row__actions">
                          <button
                            type="button"
                            className="ox-btn ox-btn-primary ox-btn-sm"
                            onClick={() => navigate(`/booking/${b.id}`)}
                          >
                            Review
                          </button>
                          <button
                            type="button"
                            className="ox-btn ox-btn-ghost ox-btn-sm"
                            disabled={acting === b.id}
                            onClick={() => { void onAction(b.id, () => bookingsApi.decline(b.id)); }}
                          >
                            Decline
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>

              <div className="acct-section">
                <div className="acct-section__head">
                  <h3 className="acct-section__title">Today&apos;s sessions</h3>
                  <span className="acct-section__count">{todaySessions.length}</span>
                </div>
                <div className="acct-section__body">
                  {todaySessions.length === 0 ? (
                    <p className="acct-empty">No sessions scheduled for today.</p>
                  ) : (
                    todaySessions.map((b) => {
                      const joinOk = canJoinBookingVideo(b.availability, b.status, new Date());
                      return (
                        <article key={b.id} className="acct-row">
                          <div className="acct-row__main">
                            <p className="acct-row__title">{b.citizen.name}</p>
                            <p className="acct-row__meta">
                              {b.availability.startTime}–{b.availability.endTime} ·{' '}
                              <span className="acct-status acct-status--info">
                                {statusChipLabel(b.status, 'LAWYER')}
                              </span>
                            </p>
                          </div>
                          <div className="acct-row__actions">
                            {['CONFIRMED', 'IN_PROGRESS'].includes(b.status) && (
                              <button
                                type="button"
                                className="ox-btn ox-btn-primary ox-btn-sm"
                                disabled={!joinOk}
                                onClick={() => navigate(`/consultation/${b.id}/preflight`)}
                              >
                                Join video
                              </button>
                            )}
                            {b.status === 'PAYMENT_SUBMITTED' && (
                              <button
                                type="button"
                                className="ox-btn ox-btn-primary ox-btn-sm"
                                disabled={acting === b.id}
                                onClick={() => { void onAction(b.id, () => bookingsApi.confirmPayment(b.id)); }}
                              >
                                Verify payment
                              </button>
                            )}
                            <button
                              type="button"
                              className="ox-btn ox-btn-ghost ox-btn-sm"
                              onClick={() => navigate(`/booking/${b.id}`)}
                            >
                              Open
                            </button>
                          </div>
                        </article>
                      );
                    })
                  )}

                  {paymentsToVerify.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--acct-border, rgba(13,59,46,0.12))' }}>
                      <div className="acct-section__head">
                        <h4 className="acct-section__title" style={{ fontSize: '0.95rem' }}>Payments to verify</h4>
                      </div>
                      {paymentsToVerify.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          className="acct-row acct-row--clickable"
                          onClick={() => navigate(`/booking/${b.id}`)}
                        >
                          <div className="acct-row__main">
                            <p className="acct-row__title">{b.citizen.name}</p>
                            <p className="acct-row__meta">{fmtSlot(b)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <StaffListPreview
              title="Recent consultations"
              items={completed}
              limit={5}
              seeAllHref="/lawyer/history"
              seeAllLabel="See all"
              empty={<p className="acct-empty">No completed consultations yet.</p>}
              renderItem={(b) => (
                <button
                  type="button"
                  className="acct-row acct-row--clickable"
                  onClick={() => navigate(`/booking/${b.id}`)}
                >
                  <div className="acct-row__main">
                    <p className="acct-row__title">{b.citizen.name}</p>
                    <p className="acct-row__meta">
                      {fmtSlot(b)} · <span className="acct-status">{statusChipLabel(b.status)}</span>
                    </p>
                  </div>
                </button>
              )}
            />
          </>
        )}
      </div>
    </AppShell>
  );
};

export default LawyerDashboard;
