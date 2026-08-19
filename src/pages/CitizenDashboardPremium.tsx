import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/shell/AppShell';
import { useAuth } from '../context/AuthContext';
import { bookingsApi, type Booking } from '../services/api';
import { onBookingUpdated, onNotificationNew } from '../services/appSocket';
import { getCitizenNav } from '../utils/citizenWorkspace';
import { ApiLoadBanner } from '../components/ui/ApiLoadBanner';
import { loadErrorMessage } from '../utils/loadErrorMessage';
import { DashWelcome } from '../components/dashboard/DashWelcome';
import { DashHistorySkeleton } from '../components/dashboard/DashHistorySkeleton';
import { statusChipLabel } from '../utils/bookingStatusChip';
import { useBookingDock } from '../context/BookingDockContext';
import { canJoinBookingVideo } from '../utils/bookingSlotWindow';
import { OxStatusCallout } from '../components/ui/OxStatusCallout';
import StaffListPreview from '../components/staff/StaffListPreview';
import { computeCitizenTrustScore, isCitizenBookingUnlocked } from '../utils/trustScore';
import { CitizenBriefPanel } from '../components/citizen/CitizenBriefPanel';

const CITIZEN_ID_SHORT: Record<string, string> = {
  PHILID: 'PhilSys',
  DRIVERS_LICENSE: "Driver's License",
  PASSPORT: 'Passport',
  STUDENT_ID: 'Student ID',
  UMID: 'UMID',
  POSTAL: 'Postal ID',
  VOTER: "Voter's ID",
  OTHER_GOV: 'Government ID',
};

function maskCitizenId(value?: string | null): string | null {
  const digits = (value || '').replace(/\s+/g, '').trim();
  if (!digits) return null;
  if (digits.length <= 4) return 'On file';
  return `•••• ${digits.slice(-4)}`;
}

function fmtSlot(b: Booking) {
  const dateStr = new Date(b.availability.date).toLocaleDateString('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
  return `${dateStr} · ${b.availability.startTime}–${b.availability.endTime}`;
}

export const CitizenDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const bookingDock = useBookingDock();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadData = useCallback(() => {
    setLoading(true);
    setLoadError('');
    bookingsApi.getMy({ limit: 50 })
      .then(({ bookings: list }) => setBookings(list))
      .catch((e) => {
        setBookings([]);
        setLoadError(loadErrorMessage(e, 'Could not load dashboard data.'));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => onBookingUpdated(() => loadData()), [loadData]);
  useEffect(() => onNotificationNew(() => loadData()), [loadData]);

  useEffect(() => {
    if (loading) return;
    const id = location.hash.replace('#', '');
    if (!id) return;
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(t);
  }, [location.hash, loading]);

  const active = useMemo(
    () => bookings.filter((b) => ['CONFIRMED', 'IN_PROGRESS'].includes(b.status)),
    [bookings],
  );
  const pending = useMemo(
    () => bookings.filter((b) =>
      ['REQUESTED', 'APPROVED', 'PAYMENT_SUBMITTED'].includes(b.status)),
    [bookings],
  );
  const past = useMemo(
    () => bookings.filter((b) =>
      !['REQUESTED', 'APPROVED', 'PAYMENT_SUBMITTED', 'CONFIRMED', 'IN_PROGRESS'].includes(b.status)),
    [bookings],
  );
  const completedCount = past.filter((b) => b.status === 'COMPLETED' || b.status === 'RATED').length;

  const userName = user?.name?.split(' ')[0] || 'User';
  const trust = computeCitizenTrustScore(user || {});
  const bookingUnlocked = isCitizenBookingUnlocked(user);
  const idVerified = Boolean(
    user?.isVerified || user?.citizenVerificationStatus === 'VERIFIED',
  );
  const verifyStatus = user?.citizenVerificationStatus || 'NOT_STARTED';
  const idMeta = [
    user?.citizenIdType ? (CITIZEN_ID_SHORT[user.citizenIdType] || 'Government ID') : null,
    maskCitizenId(user?.citizenIdNumber),
    [user?.city, user?.province].filter(Boolean).join(', ') || user?.address || null,
    `Trust ${trust.score} / 100`,
  ].filter(Boolean).join(' · ');

  return (
    <AppShell title="Dashboard" navItems={getCitizenNav(user)} hidePageHeader>
      <div className="dash-layout dash-layout--premium">
        <DashWelcome
          userName={userName}
          subtitle="Browse lawyers, book consults, and keep your case history in one place."
        />

        {idVerified ? (
          <OxStatusCallout
            variant="verify"
            icon="verified"
            title={bookingUnlocked
              ? 'Verified citizen — lawyer directory unlocked'
              : 'Verified citizen — identity on file'}
            action={(
              <button
                type="button"
                className="ox-btn ox-btn-secondary ox-btn-sm"
                onClick={() => navigate('/settings?tab=verification')}
              >
                View identity credentials
              </button>
            )}
          >
            <p>{idMeta || 'Your verification is on file in Account Settings.'}</p>
          </OxStatusCallout>
        ) : verifyStatus === 'PENDING' ? (
          <OxStatusCallout
            variant="warn"
            title="Identity verification in review"
            action={(
              <button
                type="button"
                className="ox-btn ox-btn-primary ox-btn-sm"
                onClick={() => navigate('/settings?tab=verification')}
              >
                View status
              </button>
            )}
          >
            <p>Your ID documents were submitted. Finish remaining profile checks while we confirm your identity.</p>
            <ul className="ox-callout__checks">
              {trust.checks.map((check) => (
                <li key={check.id}>{check.verified ? 'Provided' : 'Pending'} — {check.label}</li>
              ))}
            </ul>
          </OxStatusCallout>
        ) : verifyStatus === 'REJECTED' ? (
          <OxStatusCallout
            variant="warn"
            title="Identity verification needs attention"
            action={(
              <button
                type="button"
                className="ox-btn ox-btn-primary ox-btn-sm"
                onClick={() => navigate('/settings?tab=verification')}
              >
                Resubmit ID
              </button>
            )}
          >
            <p>Resubmit a clear government ID and a selfie holding that same ID to continue verification.</p>
          </OxStatusCallout>
        ) : (
          <OxStatusCallout
            variant="warn"
            title="Profile verification required to access the lawyer directory"
            action={(
              <button
                type="button"
                className="ox-btn ox-btn-primary ox-btn-sm"
                onClick={() => navigate('/settings?tab=verification')}
              >
                Complete profile
              </button>
            )}
          >
            <p>Complete your domicile address and government ID to unlock lawyer scheduling.</p>
            <ul className="ox-callout__checks">
              {trust.checks.map((check) => (
                <li key={check.id}>{check.verified ? 'Provided' : 'Pending'} — {check.label}</li>
              ))}
            </ul>
          </OxStatusCallout>
        )}

        {loadError && <ApiLoadBanner message={loadError} onRetry={loadData} />}

        <CitizenBriefPanel />

        {loading ? (
          <DashHistorySkeleton label="Loading dashboard" />
        ) : (
          <>
            <p className="acct-stat-line">
              <span><strong>{active.length}</strong> active</span>
              <span><strong>{pending.length}</strong> pending</span>
              <span><strong>{completedCount}</strong> completed</span>
              <span><strong>{bookings.length}</strong> total</span>
            </p>

            <div className="staff-page-grid staff-page-grid--2" style={{ marginBottom: '0.75rem' }}>
              <div className="acct-section">
                <div className="acct-section__head">
                  <h3 className="acct-section__title">Active consultations</h3>
                  <span className="acct-section__count">{active.length}</span>
                </div>
                <div className="acct-section__body">
                  {active.length === 0 ? (
                    <p className="acct-empty">
                      No active consultations.{' '}
                      <Link to="/directory" className="list-panel__link">Find a lawyer</Link>
                    </p>
                  ) : (
                    active.slice(0, 5).map((b) => {
                      const joinOk = canJoinBookingVideo(b.availability, b.status, new Date());
                      return (
                        <article key={b.id} className="acct-row">
                          <div className="acct-row__main">
                            <p className="acct-row__title">{b.lawyer.name}</p>
                            <p className="acct-row__meta">
                              {fmtSlot(b)} · <span className="acct-status acct-status--info">{statusChipLabel(b.status)}</span>
                            </p>
                          </div>
                          <div className="acct-row__actions">
                            <button
                              type="button"
                              className="ox-btn ox-btn-primary ox-btn-sm"
                              disabled={!joinOk}
                              onClick={() => navigate(`/consultation/${b.id}/preflight`)}
                            >
                              Join video
                            </button>
                            <button
                              type="button"
                              className="ox-btn ox-btn-ghost ox-btn-sm"
                              onClick={() => bookingDock.openBooking(b.id, { expand: true })}
                            >
                              Chat
                            </button>
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
                </div>
              </div>

              <div className="acct-section">
                <div className="acct-section__head">
                  <h3 className="acct-section__title">Pending requests</h3>
                  <span className="acct-section__count">{pending.length}</span>
                </div>
                <div className="acct-section__body">
                  {pending.length === 0 ? (
                    <p className="acct-empty">No pending requests.</p>
                  ) : (
                    pending.slice(0, 5).map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        className="acct-row acct-row--clickable"
                        onClick={() => navigate(`/booking/${b.id}`)}
                      >
                        <div className="acct-row__main">
                          <p className="acct-row__title">{b.lawyer.name}</p>
                          <p className="acct-row__meta">
                            {fmtSlot(b)} · {statusChipLabel(b.status)}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            <StaffListPreview
              title="Consultation history"
              items={past}
              limit={5}
              seeAllHref="/history"
              seeAllLabel="View all"
              empty={<p className="acct-empty">No past consultations yet.</p>}
              renderItem={(b) => (
                <button
                  type="button"
                  className="acct-row acct-row--clickable"
                  onClick={() => navigate(`/booking/${b.id}`)}
                >
                  <div className="acct-row__main">
                    <p className="acct-row__title">{b.lawyer.name}</p>
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

export default CitizenDashboard;
