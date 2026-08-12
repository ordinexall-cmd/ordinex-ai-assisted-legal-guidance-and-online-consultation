import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/shell/AppShell';
import { bookingsApi, type Booking } from '../services/api';
import { getCitizenNav } from '../utils/citizenWorkspace';
import { getAppBackFallback } from '../utils/navigation';
import { onBookingUpdated } from '../services/appSocket';
import { ApiLoadBanner } from '../components/ui/ApiLoadBanner';
import { loadErrorMessage } from '../utils/loadErrorMessage';
import { ScheduleMonthGrid } from '../components/schedule/ScheduleMonthGrid';
import { citizenBookingCalendarStyle } from '../utils/calendarEventStyle';
import { statusChipLabel } from '../utils/bookingStatusChip';
import { BookingStatusStepper } from '../components/booking/BookingStatusStepper';

const STATUS_GROUPS: { key: string; label: string; statuses: string[] }[] = [
  { key: 'pending', label: 'Pending confirmation', statuses: ['REQUESTED'] },
  { key: 'approved', label: 'Approved — awaiting payment', statuses: ['APPROVED'] },
  { key: 'payment', label: 'Payment submitted', statuses: ['PAYMENT_SUBMITTED'] },
  { key: 'confirmed', label: 'Confirmed schedules', statuses: ['CONFIRMED', 'IN_PROGRESS'] },
];

function fmtSlot(b: Booking) {
  return `${new Date(b.availability.date).toLocaleDateString('en-PH', {
    weekday: 'short', month: 'short', day: 'numeric',
  })} · ${b.availability.startTime}–${b.availability.endTime}`;
}

export const ScheduleCalendar: React.FC = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    bookingsApi.getMy({ limit: 100 })
      .then((r) => {
        setBookings(r.bookings);
        setLastUpdate(new Date());
      })
      .catch((e) => setError(loadErrorMessage(e, 'Could not load schedule.')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => onBookingUpdated(() => load()), [load]);

  const ACTIVE_CALENDAR_STATUSES = [
    'REQUESTED', 'APPROVED', 'PAYMENT_SUBMITTED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'RATED',
  ];

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
          onClick: () => navigate(`/booking/${b.id}`),
        };
      }),
    [bookings, navigate],
  );

  return (
    <AppShell
      variant="flow"
      title="Schedule Calendar"
      navItems={getCitizenNav()}
      stepLabel="Calendar"
      backTo={getAppBackFallback(false)}
    >
      <div className="staff-workspace">
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
            <ScheduleMonthGrid
              events={calendarEvents}
              emptyHint="No bookings on the calendar yet."
            />

            <div className="staff-page-grid staff-page-grid--2" style={{ marginTop: '0.75rem' }}>
              {STATUS_GROUPS.map((group) => {
                const items = bookings.filter((b) => group.statuses.includes(b.status));
                return (
                  <div key={group.key} className="staff-panel">
                    <div className="staff-panel__title-row">
                      <h3 className="staff-panel__title">{group.label}</h3>
                      <span className="staff-badge staff-badge--waiting">{items.length}</span>
                    </div>
                    {items.length === 0 ? (
                      <p className="staff-empty-hint">None.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {items.map((b) => (
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
                );
              })}
            </div>

            <div className="staff-actions" style={{ marginTop: '0.75rem' }}>
              <Link to="/lawyers" className="ox-btn ox-btn-primary">Book a lawyer</Link>
              <Link to="/history" className="ox-btn ox-btn-ghost">View history</Link>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
};

export default ScheduleCalendar;
