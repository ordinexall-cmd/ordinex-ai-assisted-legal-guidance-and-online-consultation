import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/shell/AppShell';
import { useAuth } from '../context/AuthContext';
import { availabilityApi, bookingsApi, type AvailabilitySlot, type Booking } from '../services/api';
import { onAvailabilityChanged, onBookingUpdated } from '../services/appSocket';
import { getLawyerNav } from '../utils/lawyerWorkspace';
import { getAppBackFallback } from '../utils/navigation';
import { getErrorMessage } from '../utils/userFacingError';
import { ScheduleMonthGrid, type ScheduleCalendarEvent } from '../components/schedule/ScheduleMonthGrid';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_PRESET = [1, 2, 3, 4, 5];
const DEFAULT_RANGE_MONTHS = 3;
const LOAD_MONTHS = 4;

/** Local calendar YYYY-MM-DD (avoids UTC shift from toISOString). */
const toDateInput = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

function addMonthsYmd(dateStr: string, months: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setMonth(d.getMonth() + months);
  return toDateInput(d);
}

function expandWeekdayRange(startDate: string, endDate: string, daysOfWeek: number[]): string[] {
  const out: string[] = [];
  const cur = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(cur.getTime()) || Number.isNaN(end.getTime()) || cur > end) return out;

  const filterByWeekday = daysOfWeek.length > 0;
  while (cur <= end) {
    if (!filterByWeekday || daysOfWeek.includes(cur.getDay())) {
      out.push(toDateInput(cur));
    }
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function weekdayPreviewLabel(days: number[]): string {
  if (days.length === 0) return 'every day';
  if (days.length === 5 && days.every((d, i) => d === WEEKDAY_PRESET[i])) return 'Mon–Fri';
  return days.map((d) => DAY_NAMES[d]).join(', ');
}

export const LawyerSchedule: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  const [defaultDate] = useState(() => toDateInput(new Date()));
  const [startDate, setStartDate] = useState(defaultDate);
  const [endDate, setEndDate] = useState(() => addMonthsYmd(toDateInput(new Date()), DEFAULT_RANGE_MONTHS));
  const [newStart, setNewStart] = useState('09:00');
  const [newEnd, setNewEnd] = useState('12:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([...WEEKDAY_PRESET]);

  const effectiveEnd = selectedDays.length > 0 && startDate === endDate
    ? addMonthsYmd(startDate, DEFAULT_RANGE_MONTHS)
    : endDate;
  const previewDates = useMemo(
    () => expandWeekdayRange(startDate, effectiveEnd, selectedDays),
    [startDate, effectiveEnd, selectedDays],
  );

  const load = useCallback(() => {
    setLoading(true);
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setMonth(to.getMonth() + LOAD_MONTHS);
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

  const toggleDay = (day: number, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    );
  };

  const handleAdd = async () => {
    if (!startDate || !endDate) {
      setError('Start and end dates are required.');
      return;
    }
    if (startDate > endDate) {
      setError('End date must be on or after start date.');
      return;
    }
    if (selectedDays.length === 0 && startDate !== endDate) {
      setError('Select at least one day of the week.');
      return;
    }
    if (newStart >= newEnd) {
      setError('End time must be after start time.');
      return;
    }
    const rangeEnd = selectedDays.length > 0 && startDate === endDate
      ? addMonthsYmd(startDate, DEFAULT_RANGE_MONTHS)
      : endDate;
    if (rangeEnd !== endDate) setEndDate(rangeEnd);
    const dates = expandWeekdayRange(startDate, rangeEnd, selectedDays);
    if (dates.length === 0) {
      setError('No matching weekdays in the selected range. Adjust dates or days of week.');
      return;
    }
    const existingKeys = new Set(
      slots.map((s) => `${String(s.date).slice(0, 10)}|${s.startTime}|${s.endTime}`),
    );
    const toCreate = dates.filter((date) => !existingKeys.has(`${date}|${newStart}|${newEnd}`));
    if (toCreate.length === 0) {
      setError('Those duty hours already exist in this range.');
      return;
    }
    setAdding(true);
    setError('');
    try {
      await availabilityApi.createBatch(
        toCreate.map((date) => ({ date, startTime: newStart, endTime: newEnd })),
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
      title="Duty Roster"
      navItems={getLawyerNav(user)}
      stepLabel="Duty Roster"
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
                  Pick start and end dates, then weekdays. Mon–Fri over a 3-month range creates every weekday in that span.
                </p>
                <div className="staff-form--compact">
                  <div>
                    <label htmlFor="duty-start-date">Start date</label>
                    <input
                      id="duty-start-date"
                      type="date"
                      className="ox-input"
                      min={toDateInput(new Date())}
                      value={startDate}
                      onChange={(e) => {
                        const v = e.target.value;
                        setStartDate(v);
                        if (endDate < v) setEndDate(addMonthsYmd(v, DEFAULT_RANGE_MONTHS));
                      }}
                    />
                  </div>
                  <div>
                    <label htmlFor="duty-end-date">End date</label>
                    <input
                      id="duty-end-date"
                      type="date"
                      className="ox-input"
                      min={startDate || toDateInput(new Date())}
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-ox-emerald)' }}>
                      Days of week
                    </span>
                    <p className="staff-empty-hint" style={{ margin: '0.25rem 0 0' }}>
                      Every selected weekday between Start and End is added. If Start and End are the same day, the range extends 3 months.
                    </p>
                    <div className="staff-weekday-pills" role="group" aria-label="Days of week" style={{ marginTop: 6 }}>
                      {DAY_LABELS.map((label, day) => (
                        <button
                          key={`dow-${day}`}
                          type="button"
                          className={`staff-weekday-pill${selectedDays.includes(day) ? ' staff-weekday-pill--active' : ''}`}
                          onClick={(e) => toggleDay(day, e)}
                          aria-pressed={selectedDays.includes(day)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {previewDates.length > 0 && (
                      <p className="staff-empty-hint" style={{ marginTop: 8 }}>
                        Will create {previewDates.length} {weekdayPreviewLabel(selectedDays)} slot{previewDates.length === 1 ? '' : 's'}
                        {' '}({previewDates[0]} to {previewDates[previewDates.length - 1]}).
                      </p>
                    )}
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
