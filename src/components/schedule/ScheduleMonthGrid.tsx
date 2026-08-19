import React, { useMemo, useState } from 'react';
import type { CalendarColorVariant } from '../../utils/calendarEventStyle';

export interface ScheduleCalendarEvent {
  readonly id: string;
  readonly date: string;
  readonly label: string;
  readonly colorVariant?: CalendarColorVariant | 'gold' | 'red' | 'gray';
  readonly completed?: boolean;
  readonly onClick?: () => void;
}

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const days: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
  return days;
}

interface Props {
  readonly events: ScheduleCalendarEvent[];
  readonly emptyHint?: string;
  readonly compact?: boolean;
  readonly boxed?: boolean;
  readonly selectedDate?: string | null;
  readonly onSelectDate?: (dateKey: string) => void;
}

export const ScheduleMonthGrid: React.FC<Props> = ({
  events,
  emptyHint,
  compact = false,
  boxed = false,
  selectedDate = null,
  onSelectDate,
}) => {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const byDate = useMemo(() => {
    const map = new Map<string, ScheduleCalendarEvent[]>();
    for (const e of events) {
      const key = localDateKey(new Date(e.date));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [events]);

  const days = monthDays(viewYear, viewMonth);
  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  return (
    <div className={`staff-panel schedule-calendar-grid${compact ? ' schedule-calendar-grid--compact' : ''}${boxed ? ' schedule-calendar-grid--boxed' : ''}`}>
      <div className="schedule-calendar-grid__head">
        <button type="button" className="schedule-calendar-grid__nav" onClick={prevMonth} aria-label="Previous month">
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <h3 className="schedule-calendar-grid__title">{monthLabel}</h3>
        <button type="button" className="schedule-calendar-grid__nav" onClick={nextMonth} aria-label="Next month">
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>

      <div className="schedule-calendar-grid__weekdays">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="schedule-calendar-grid__cells">
        {days.map((day, i) => {
          if (!day) {
            return <div key={`pad-${i}`} className="schedule-calendar-grid__cell schedule-calendar-grid__cell--pad" />;
          }
          const key = localDateKey(day);
          const dayEvents = byDate.get(key) || [];
          const isSelected = selectedDate === key;
          const cellClass = [
            'schedule-calendar-grid__cell',
            compact ? 'schedule-calendar-grid__cell--pick' : '',
            isSelected ? 'is-selected' : '',
            dayEvents.length ? 'has-events' : '',
          ].filter(Boolean).join(' ');

          const inner = (
            <>
              <span className="schedule-calendar-grid__day-num">{day.getDate()}</span>
              {compact ? (
                <div className="schedule-calendar-grid__dots" aria-hidden>
                  {dayEvents.slice(0, 3).map((ev) => (
                    <span
                      key={ev.id}
                      className={`schedule-calendar-grid__dot schedule-calendar-grid__dot--${ev.colorVariant || 'green'}`}
                    />
                  ))}
                </div>
              ) : (
                <div className="schedule-calendar-grid__events">
                  {dayEvents.map((ev) => {
                    const variant = ev.colorVariant || 'green';
                    const isCompleted = ev.completed;
                    return compact || onSelectDate ? (
                      <span
                        key={ev.id}
                        className={`schedule-calendar-grid__event schedule-calendar-grid__event--${variant}${isCompleted ? ' schedule-calendar-grid__event--done' : ''}`}
                      >
                        {ev.label}
                      </span>
                    ) : (
                      <button
                        key={ev.id}
                        type="button"
                        className={`schedule-calendar-grid__event schedule-calendar-grid__event--${variant}${isCompleted ? ' schedule-calendar-grid__event--done' : ''}`}
                        onClick={ev.onClick}
                      >
                        {ev.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          );

          if (onSelectDate) {
            return (
              <button
                key={key}
                type="button"
                className={cellClass}
                onClick={() => onSelectDate(key)}
                aria-pressed={isSelected}
                aria-label={`${day.toLocaleDateString('en-PH', { month: 'long', day: 'numeric' })}${dayEvents.length ? `, ${dayEvents.length} open` : ''}`}
              >
                {inner}
              </button>
            );
          }

          return (
            <div key={key} className={cellClass}>
              {inner}
            </div>
          );
        })}
      </div>
      {events.length === 0 && emptyHint ? (
        <p className="schedule-calendar-grid__empty">{emptyHint}</p>
      ) : null}
    </div>
  );
};

export default ScheduleMonthGrid;
