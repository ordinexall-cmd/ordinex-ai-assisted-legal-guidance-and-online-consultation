import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/shell/AppShell';
import { useAuth } from '../context/AuthContext';
import { bookingsApi, type Booking } from '../services/api';
import { onBookingUpdated } from '../services/appSocket';
import { getCitizenNav } from '../utils/citizenWorkspace';
import { ApiLoadBanner } from '../components/ui/ApiLoadBanner';
import { loadErrorMessage } from '../utils/loadErrorMessage';
import { DashWelcome } from '../components/dashboard/DashWelcome';
import { DashHistorySkeleton } from '../components/dashboard/DashHistorySkeleton';
import { statusChipLabel } from '../utils/bookingStatusChip';
import { useBookingDock } from '../context/BookingDockContext';
import { canJoinBookingVideo } from '../utils/bookingSlotWindow';

function fmtSlot(b: Booking) {
  const dateStr = new Date(b.availability.date).toLocaleDateString('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
  return `${dateStr} · ${b.availability.startTime}–${b.availability.endTime}`;
}

export const CitizenDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
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

  return (
    <AppShell title="Dashboard" navItems={getCitizenNav()} hidePageHeader>
      <div className="dash-layout dash-layout--premium">
        <DashWelcome
          userName={userName}
          subtitle="Browse lawyers, book consults, and keep your case history in one place."
        />

        {loadError && <ApiLoadBanner message={loadError} onRetry={loadData} />}

        {loading ? (
          <DashHistorySkeleton />
        ) : (
          <>
            <p className="acct-stat-line">
              <span><strong>{active.length}</strong> active</span>
              <span><strong>{pending.length}</strong> pending</span>
              <span><strong>{completedCount}</strong> completed</span>
              <span><strong>{bookings.length}</strong> total</span>
            </p>

            <div className="dash-split dash-split--premium staff-page-grid--sidebar">
              <div className="acct-section">
                <div className="acct-section__head">
                  <h2 className="acct-section__title">Active consultations</h2>
                  <span className="acct-section__count">{active.length}</span>
                </div>
                <div className="acct-section__body">
                  {active.length === 0 ? (
                    <p className="acct-empty">
                      No active consultations.{' '}
                      <Link to="/lawyers" className="list-panel__link">Find a lawyer</Link>
                    </p>
                  ) : (
                    active.slice(0, 3).map((b) => {
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
                  {active.length > 3 && (
                    <p className="acct-empty" style={{ paddingTop: 0 }}>
                      Showing 3 of {active.length} active
                    </p>
                  )}
                </div>
              </div>

              <div className="dash-stack-col">
                <div className="acct-section">
                  <div className="acct-section__head">
                    <h2 className="acct-section__title">Pending requests</h2>
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

                <div className="acct-section">
                  <div className="acct-section__head">
                    <h2 className="acct-section__title">Quick actions</h2>
                  </div>
                  <div className="acct-section__body" style={{ padding: '0.85rem 1rem' }}>
                    <div className="dash-quick-actions">
                      <Link to="/lawyers" className="ox-btn ox-btn-primary ox-btn-sm">Find a lawyer</Link>
                      <Link to="/ai-analysis" className="ox-btn ox-btn-ghost ox-btn-sm">New AI analysis</Link>
                      <Link to="/schedule-calendar" className="ox-btn ox-btn-ghost ox-btn-sm">Calendar</Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="acct-section">
              <div className="acct-section__head">
                <h2 className="acct-section__title">Consultation history</h2>
                <button type="button" className="list-panel__link" onClick={() => navigate('/history')}>
                  View all
                </button>
              </div>
              <div className="acct-section__body">
                {past.length === 0 ? (
                  <p className="acct-empty">No past consultations yet.</p>
                ) : (
                  past.slice(0, 5).map((b) => (
                    <button
                      key={b.id}
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
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
};

export default CitizenDashboard;
