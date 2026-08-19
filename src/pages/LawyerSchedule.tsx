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

  const [mode, setMode] = useState<'weekly' | 'onetime'>('weekly');
  const [duration, setDuration] = useState<'permanent' | 'until'>('permanent');
  const [untilDate, setUntilDate] = useState(() => addMonthsYmd(toDateInput(new Date()), DEFAULT_RANGE_MONTHS));
  const [rangeFrom, setRangeFrom] = useState(defaultDate);
  const [rangeTo, setRangeTo] = useState(() => addMonthsYmd(toDateInput(new Date()), DEFAULT_RANGE_MONTHS));
  const [bulkBusy, setBulkBusy] = useState(false);

  const rangeEnd = mode === 'weekly'
    ? (duration === 'permanent' ? addMonthsYmd(startDate, 12) : untilDate)
    : endDate;
  const previewDays = mode === 'weekly' ? selectedDays : [];
  const previewDates = useMemo(
    () => expandWeekdayRange(startDate, rangeEnd, previewDays),
    [startDate, rangeEnd, previewDays],
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
    if (!startDate) {
      setError('Start date is required.');
      return;
    }
    if (newStart >= newEnd) {
      setError('End time must be after start time.');
      return;
    }
    let dates: string[] = [];
    if (mode === 'weekly') {
      if (selectedDays.length === 0) {
        setError('Select at least one day of the week.');
        return;
      }
      const until = duration === 'permanent' ? addMonthsYmd(startDate, 12) : untilDate;
      if (until < startDate) {
        setError('Until date must be on or after Valid from.');
        return;
      }
      dates = expandWeekdayRange(startDate, until, selectedDays);
    } else {
      if (!endDate || endDate < startDate) {
        setError('End date must be on or after start date.');
        return;
      }
      dates = expandWeekdayRange(startDate, endDate, []);
    }
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

  const handleBulk = async (body: { all?: boolean; from?: string; to?: string }) => {
    setBulkBusy(true);
    setError('');
    try {
      const res = await availabilityApi.removeMany(body);
      if (res.removed === 0 && res.skipped > 0) {
        setError('Those days have bookings and cannot be removed.');
      }
      load();
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Could not remove hours.'));
    } finally {
      setBulkBusy(false);
    }
  };

  const liveBookings = useMemo(
    () => bookings.filter((b) =>
      ['REQUESTED', 'APPROVED', 'PAYMENT_SUBMITTED', 'CONFIRMED', 'IN_PROGRESS'].includes(b.status)),
    [bookings],
  );

  const calEvents: ScheduleCalendarEvent[] = useMemo(
    () => [
      ...slots.map((s) => ({
        id: s.id,
        date: s.date,
        label: `${s.startTime}-${s.endTime}`,
        colorVariant: 'green' as const,
        completed: false,
      })),
      ...liveBookings.map((b) => ({
        id: `sess-${b.id}`,
        date: b.availability.date,
        label: `${b.availability.startTime}-${b.availability.endTime}`,
        colorVariant: 'gold' as const,
        completed: true,
      })),
    ],
    [slots, liveBookings],
  );

  const openSlots = slots;

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
              <div className="staff-panel staff-panel--compact placer-roster-card" style={{ marginBottom: '0.75rem' }}>
                <h3 className="staff-panel__title">Add duty hours</h3>
                <div className="placer-mode-toggle" role="tablist" aria-label="Duty type">
                  <button
                    type="button"
                    className={`placer-mode-toggle__btn${mode === 'weekly' ? ' is-active' : ''}`}
                    onClick={() => setMode('weekly')}
                  >
                    Weekly recurring
                  </button>
                  <button
                    type="button"
                    className={`placer-mode-toggle__btn${mode === 'onetime' ? ' is-active' : ''}`}
                    onClick={() => setMode('onetime')}
                  >
                    One-time range
                  </button>
                </div>
                <div className="staff-form--compact">
                  {mode === 'weekly' && (
                    <div>
                      <span className="placer-field-label">Repeat on</span>
                      <div className="staff-weekday-pills placer-day-squares" role="group" aria-label="Days of week">
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
                    </div>
                  )}
                  <div>
                    <label htmlFor="duty-start-date">{mode === 'weekly' ? 'Valid from' : 'Start date'}</label>
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
                        if (untilDate < v) setUntilDate(addMonthsYmd(v, DEFAULT_RANGE_MONTHS));
                      }}
                    />
                  </div>
                  {mode === 'weekly' ? (
                    <div>
                      <span className="placer-field-label">Duration</span>
                      <label className="placer-radio">
                        <input type="radio" name="duty-dur" checked={duration === 'permanent'} onChange={() => setDuration('permanent')} />
                        Permanent (repeats weekly)
                      </label>
                      <label className="placer-radio">
                        <input type="radio" name="duty-dur" checked={duration === 'until'} onChange={() => setDuration('until')} />
                        Until date
                      </label>
                      {duration === 'until' && (
                        <input
                          type="date"
                          className="ox-input"
                          min={startDate}
                          value={untilDate}
                          onChange={(e) => setUntilDate(e.target.value)}
                          aria-label="Until date"
                        />
                      )}
                    </div>
                  ) : (
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
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
                    <div>
                      <label htmlFor="duty-start-time">Start time</label>
                      <input id="duty-start-time" type="time" className="ox-input" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
                    </div>
                    <div>
                      <label htmlFor="duty-end-time">End time</label>
                      <input id="duty-end-time" type="time" className="ox-input" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
                    </div>
                    <button type="button" className="ox-btn ox-btn-primary" disabled={adding} onClick={() => { void handleAdd(); }}>
                      {adding ? 'Adding…' : '+ Add Rule'}
                    </button>
                  </div>
                  {previewDates.length > 0 && (
                    <p className="staff-empty-hint" style={{ marginTop: 4 }}>
                      {mode === 'weekly'
                        ? `Repeats every ${weekdayPreviewLabel(selectedDays)} · ${newStart}–${newEnd} · ${duration === 'permanent' ? 'ongoing' : `until ${untilDate}`}`
                        : `Will create ${previewDates.length} day${previewDates.length === 1 ? '' : 's'} (${previewDates[0]} to ${previewDates[previewDates.length - 1]}).`}
                    </p>
                  )}
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
                boxed
                events={calEvents}
                emptyHint="No duty slots yet. Add hours on the left."
              />
              <details className="staff-details" open>
                <summary>Open duty slots ({openSlots.length})</summary>
                <div className="staff-details__body">
                  <div className="placer-bulk-row">
                    <button
                      type="button"
                      className="ox-btn ox-btn-ghost ox-btn-sm"
                      disabled={bulkBusy || openSlots.length === 0}
                      onClick={() => {
                        if (window.confirm(`Remove ${openSlots.length} unused open days? Hours with bookings stay.`)) {
                          void handleBulk({ all: true });
                        }
                      }}
                    >
                      Remove all
                    </button>
                    <input type="date" className="ox-input" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} aria-label="Range start" />
                    <input type="date" className="ox-input" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} aria-label="Range end" />
                    <button
                      type="button"
                      className="ox-btn ox-btn-ghost ox-btn-sm"
                      disabled={bulkBusy}
                      onClick={() => { void handleBulk({ from: rangeFrom, to: rangeTo }); }}
                    >
                      Remove range
                    </button>
                  </div>
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
                        <button type="button" className="ox-btn ox-btn-ghost ox-btn-sm placer-remove" onClick={() => { void handleDelete(s.id); }}>
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
