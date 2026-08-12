import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/shell/AppShell';
import { useAuth } from '../context/AuthContext';
import { availabilityApi, bookingsApi, type AvailabilitySlot, type Booking } from '../services/api';
import { onAvailabilityChanged, onBookingUpdated } from '../services/appSocket';
import { lawyerNav } from '../utils/lawyerWorkspace';
import { getAppBackFallback } from '../utils/navigation';
import { getErrorMessage } from '../utils/userFacingError';
import { ScheduleMonthGrid, type ScheduleCalendarEvent } from '../components/schedule/ScheduleMonthGrid';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_PRESET = [1, 2, 3, 4, 5];

const toDateInput = (d: Date) => d.toISOString().slice(0, 10);

function expandWeekdayRange(startDate: string, endDate: string, daysOfWeek: number[]): string[] {
  const out: string[] = [];
  const cur = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(cur.getTime()) || Number.isNaN(end.getTime()) || cur > end) return out;
  while (cur <= end) {
    if (daysOfWeek.includes(cur.getDay())) {
      out.push(toDateInput(cur));
    }
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export const LawyerSchedule: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  const [defaultDate] = useState(() => toDateInput(new Date(Date.now() + 86400_000)));
  const [startDate, setStartDate] = useState(defaultDate);
  const [endDate, setEndDate] = useState(defaultDate);
  const [newStart, setNewStart] = useState('09:00');
  const [newEnd, setNewEnd] = useState('12:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([...WEEKDAY_PRESET]);

  const load = useCallback(() => {
    setLoading(true);
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 60);
    Promise.all([
      availabilityApi.getMy(toDateInput(from), toDateInput(to)),
      bookingsApi.getMy({ limit: 50 }),
    ])
      .then(([{ slots: s }, { bookings: b }]) => {
        setSlots(s);
        setBookings(b);
        setError('');
      })
      .catch((e) => setError(getErrorMessage(e, 'Could not load schedule.')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => onAvailabilityChanged(() => load()), [load]);
  useEffect(() => onBookingUpdated(() => load()), [load]);

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    );
  };

  const handleAdd = async () => {
    if (!startDate || !endDate) {
      setError('Start and end dates are required.');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setError('End date must be on or after start date.');
      return;
    }
    if (selectedDays.length === 0) {
      setError('Select at least one day of the week.');
      return;
    }
    if (newStart >= newEnd) {
      setError('End time must be after start time.');
      return;
    }
    const dates = expandWeekdayRange(startDate, endDate, selectedDays);
    if (dates.length === 0) {
      setError('No matching weekdays in the selected range.');
      return;
    }
    setAdding(true);
    setError('');
    try {
      await availabilityApi.createBatch(
        dates.map((date) => ({ date, startTime: newStart, endTime: newEnd })),
      );
      load();
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Failed to add slots.'));
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await availabilityApi.remove(id);
      load();
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Failed to remove slot.'));
    }
  };

  const bookedKeys = useMemo(() => {
    const set = new Set<string>();
    for (const b of bookings) {
      if (['DECLINED', 'AUTO_CANCELLED'].includes(b.status)) continue;
      set.add(`${b.availability.date.slice(0, 10)}|${b.availability.startTime}|${b.availability.endTime}`);
    }
    return set;
  }, [bookings]);

  const calEvents: ScheduleCalendarEvent[] = useMemo(
    () =>
      slots.map((s) => {
        const key = `${s.date.slice(0, 10)}|${s.startTime}|${s.endTime}`;
        const isBooked = Boolean(s.isBooked) || bookedKeys.has(key);
        return {
          id: s.id,
          date: s.date,
          label: `${s.startTime}-${s.endTime}${isBooked ? ' ✓' : ''}`,
          colorVariant: isBooked ? 'gold' : 'green',
          completed: isBooked,
        };
      }),
    [slots, bookedKeys],
  );

  const openSlots = slots.filter((s) => {
    const key = `${s.date.slice(0, 10)}|${s.startTime}|${s.endTime}`;
    return !s.isBooked && !bookedKeys.has(key);
  });

  return (
    <AppShell
      variant="flow"
      title="Duty schedule"
      navItems={lawyerNav}
      stepLabel="Schedule"
      backTo={getAppBackFallback(true)}
    >
      <div className="staff-workspace">
        <p className="staff-empty-hint" style={{ marginBottom: '0.75rem' }}>
          Set your open consultation hours. Citizens book from these slots.
          {user?.name ? ` Logged in as ${user.name}.` : ''}
        </p>

        {error && <div className="staff-alert staff-alert--error">{error}</div>}

        {loading ? (
          <p className="staff-empty-hint">Loading…</p>
        ) : (
          <div className="staff-page-grid staff-page-grid--2">
            <div>
              <div className="staff-panel staff-panel--compact" style={{ marginBottom: '0.75rem' }}>
                <h3 className="staff-panel__title">Add duty hours</h3>
                <p className="staff-empty-hint" style={{ marginBottom: '0.75rem' }}>
                  One-time or date-range batch. Pick weekdays to include in the range.
                </p>
                <div className="staff-form--compact">
                  <div>
                    <label htmlFor="duty-start-date">Start date</label>
                    <input id="duty-start-date" type="date" className="ox-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="duty-end-date">End date</label>
                    <input id="duty-end-date" type="date" className="ox-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-ox-emerald)' }}>Days of week</span>
                    <div className="staff-weekday-pills" style={{ marginTop: 6 }}>
                      {DAY_LABELS.map((label, day) => (
                        <button
                          key={`${label}-${day}`}
                          type="button"
                          className={`staff-weekday-pill${selectedDays.includes(day) ? ' staff-weekday-pill--active' : ''}`}
                          onClick={() => toggleDay(day)}
                          aria-pressed={selectedDays.includes(day)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <label htmlFor="duty-start-time">Start</label>
                      <input id="duty-start-time" type="time" className="ox-input" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
                    </div>
                    <div>
                      <label htmlFor="duty-end-time">End</label>
                      <input id="duty-end-time" type="time" className="ox-input" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
                    </div>
                  </div>
                  <button type="button" className="ox-btn ox-btn-primary" disabled={adding} onClick={() => { void handleAdd(); }}>
                    {adding ? 'Adding…' : 'Add slots'}
                  </button>
                </div>
              </div>

              <div className="staff-panel staff-panel--compact">
                <h3 className="staff-panel__title">Booked sessions</h3>
                {bookings.filter((b) => ['REQUESTED', 'APPROVED', 'PAYMENT_SUBMITTED', 'CONFIRMED', 'IN_PROGRESS'].includes(b.status)).length === 0 ? (
                  <p className="staff-empty-hint">No upcoming bookings.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {bookings
                      .filter((b) => ['REQUESTED', 'APPROVED', 'PAYMENT_SUBMITTED', 'CONFIRMED', 'IN_PROGRESS'].includes(b.status))
                      .slice(0, 8)
                      .map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          className="staff-card-row"
                          onClick={() => navigate(`/booking/${b.id}`)}
                        >
                          <p className="staff-card-row__title">{b.citizen.name}</p>
                          <p className="staff-card-row__meta">
                            {new Date(b.availability.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                            {' · '}
                            {b.availability.startTime}–{b.availability.endTime}
                            {' · '}
                            {b.status.replace(/_/g, ' ')}
                          </p>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <ScheduleMonthGrid
                events={calEvents}
                emptyHint="No duty slots yet. Add hours on the left."
              />
              <details className="staff-details" open>
                <summary>Open duty slots ({openSlots.length})</summary>
                <div className="staff-details__body">
                  {openSlots.length === 0 ? (
                    <p className="staff-empty-hint">No open slots.</p>
                  ) : (
                    openSlots.map((s) => (
                      <div key={s.id} className="staff-slot-row">
                        <span>
                          {new Date(s.date).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })}
                          {' · '}
                          {s.startTime}–{s.endTime}
                        </span>
                        <button type="button" className="ox-btn ox-btn-ghost ox-btn-sm" onClick={() => { void handleDelete(s.id); }}>
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </details>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default LawyerSchedule;
