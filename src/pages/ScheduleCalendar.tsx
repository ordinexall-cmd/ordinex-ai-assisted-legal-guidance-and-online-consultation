import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/shell/AppShell';
import { useAuth } from '../context/AuthContext';
import { bookingsApi, type Booking } from '../services/api';
import { getCitizenNav } from '../utils/citizenWorkspace';
import { isCitizenBookingUnlocked } from '../utils/trustScore';
import { getAppBackFallback } from '../utils/navigation';
import { onBookingUpdated } from '../services/appSocket';
import { ApiLoadBanner } from '../components/ui/ApiLoadBanner';
import { loadErrorMessage } from '../utils/loadErrorMessage';
import { ScheduleMonthGrid, localDateKey } from '../components/schedule/ScheduleMonthGrid';
import { citizenBookingCalendarStyle } from '../utils/calendarEventStyle';
import { statusChipLabel } from '../utils/bookingStatusChip';
import { BookingStatusStepper } from '../components/booking/BookingStatusStepper';
import { VerificationGateNotice } from '../components/auth/VerificationGateNotice';
import { CitizenBriefPanel } from '../components/citizen/CitizenBriefPanel';

const STATUS_FILTERS: { key: string; label: string; statuses: string[] | null }[] = [
  { key: 'all', label: 'All', statuses: null },
  { key: 'pending', label: 'Pending', statuses: ['REQUESTED'] },
  { key: 'payment', label: 'Payment', statuses: ['APPROVED', 'PAYMENT_SUBMITTED'] },
  { key: 'confirmed', label: 'Confirmed', statuses: ['CONFIRMED', 'IN_PROGRESS'] },
];

const ACTIVE_CALENDAR_STATUSES = [
  'REQUESTED', 'APPROVED', 'PAYMENT_SUBMITTED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'RATED',
];

function fmtSlot(b: Booking) {
  return `${new Date(b.availability.date).toLocaleDateString('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric',
  })} · ${b.availability.startTime}–${b.availability.endTime}`;
}

export const ScheduleCalendar: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(() => {
    if (user?.role === 'CITIZEN' && !isCitizenBookingUnlocked(user)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    bookingsApi.getMy({ limit: 100 })
      .then((r) => {
        setBookings(r.bookings);
        setLastUpdate(new Date());
      })
      .catch((e) => setError(loadErrorMessage(e, 'Could not load schedule.')))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => onBookingUpdated(() => load()), [load]);

  const calendarEvents = useMemo(
    () => bookings
      .filter((b) => ACTIVE_CALENDAR_STATUSES.includes(b.status))
      .map((b) => {
        const style = citizenBookingCalendarStyle(b.status);
        return {
          id: b.id,
          date: b.availability.date,
          label: `${b.lawyer.name.split(' ')[0]} · ${b.availability.startTime}`,
          colorVariant: style.colorVariant,
          completed: style.completed,
        };
      }),
    [bookings],
  );

  const tickets = useMemo(() => {
    const filter = STATUS_FILTERS.find((f) => f.key === statusFilter);
    return bookings.filter((b) => {
      if (!ACTIVE_CALENDAR_STATUSES.includes(b.status)) return false;
      if (filter?.statuses && !filter.statuses.includes(b.status)) return false;
      if (selectedDate && localDateKey(new Date(b.availability.date)) !== selectedDate) return false;
      return true;
    });
  }, [bookings, selectedDate, statusFilter]);

  if (user?.role === 'CITIZEN' && !isCitizenBookingUnlocked(user)) {
    return (
      <AppShell
        variant="flow"
        title="Schedule Calendar"
        navItems={getCitizenNav(user)}
        stepLabel="Calendar"
        backTo={getAppBackFallback(false)}
      >
        <VerificationGateNotice
          title="Profile Verification Required"
          featureName="Consultation Scheduling & Calendar"
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      variant="flow"
      title="Schedule Calendar"
      navItems={getCitizenNav(user)}
      stepLabel="Calendar"
      backTo={getAppBackFallback(false)}
    >
      <div className="staff-workspace">
        <CitizenBriefPanel />

        {lastUpdate && (
          <p className="staff-empty-hint" style={{ marginBottom: 8 }}>
            Updated {lastUpdate.toLocaleTimeString()}
          </p>
        )}
        {error && <ApiLoadBanner message={error} onRetry={load} />}

        {loading ? (
          <p className="staff-empty-hint">Loading…</p>
        ) : (
          <>
            <div className="schedule-split">
              <ScheduleMonthGrid
                events={calendarEvents}
                emptyHint="No bookings on the calendar yet."
                compact
                selectedDate={selectedDate}
                onSelectDate={(key) => setSelectedDate((prev) => (prev === key ? null : key))}
              />

              <div className="staff-panel schedule-ticket-panel">
                <div className="staff-panel__title-row">
                  <h3 className="staff-panel__title">Bookings</h3>
                  <span className="staff-badge staff-badge--waiting">{tickets.length}</span>
                </div>
                {selectedDate && (
                  <button
                    type="button"
                    className="list-panel__link"
                    style={{ marginBottom: 8 }}
                    onClick={() => setSelectedDate(null)}
                  >
                    Show all dates
                  </button>
                )}
                <div className="schedule-ticket-filters" role="group" aria-label="Filter bookings by status">
                  {STATUS_FILTERS.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      className={`analysis-describe__chip${statusFilter === f.key ? ' analysis-describe__chip--active' : ''}`}
                      aria-pressed={statusFilter === f.key}
                      onClick={() => setStatusFilter(f.key)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                {tickets.length === 0 ? (
                  <p className="staff-empty-hint">
                    {selectedDate ? 'No bookings on this day.' : 'No bookings yet.'}
                  </p>
                ) : (
                  <div className="schedule-ticket-list">
                    {tickets.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        className="staff-card-row"
                        onClick={() => navigate(`/booking/${b.id}`)}
                      >
                        <p className="staff-card-row__title">{b.lawyer.name}</p>
                        <p className="staff-card-row__meta">
                          {fmtSlot(b)} · {statusChipLabel(b.status)}
                        </p>
                        <BookingStatusStepper status={b.status} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="staff-actions" style={{ marginTop: '0.75rem' }}>
              <Link to="/directory" className="ox-btn ox-btn-primary">Book a lawyer</Link>
              <Link to="/history" className="ox-btn ox-btn-ghost">View history</Link>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
};

export default ScheduleCalendar;
