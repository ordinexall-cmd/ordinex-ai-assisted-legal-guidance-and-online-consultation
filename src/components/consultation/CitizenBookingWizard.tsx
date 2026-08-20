import React, { useEffect, useMemo, useState } from 'react';
import type { AvailabilitySlot, ConsultationResult, LawyerProfile } from '../../services/api';
import { hasBookingCaseContext, bookingCaseContextError } from '../../utils/bookingCaseContext';
import { holdEnd, preferredStartsInWindow } from '../../utils/sessionOverlap';
import { UserAvatar } from '../UserAvatar';
import '../../styles/consult-booking.css';

const CASE_DESCRIPTION_MAX = 2000;

const STEP_LABELS = ['Case context', 'Pick a slot'];

export interface CitizenBookingWizardProps {
  readonly lawyer: LawyerProfile;
  readonly slots: AvailabilitySlot[];
  readonly history: ConsultationResult[];
  readonly initialConsultationId?: string;
  readonly loading?: boolean;
  readonly error?: string;
  /** When parent calendar picks a day, jump to slot step (if case context is ready). */
  readonly preferredDate?: string | null;
  readonly onPreferredDateConsumed?: () => void;
  readonly onDatePicked?: (date: string) => void;
  readonly onSubmit: (payload: {
    availabilityId: string;
    preferredStartTime: string;
    consultationId?: string;
    caseDescription?: string;
  }) => void;
}

export const CitizenBookingWizard: React.FC<CitizenBookingWizardProps> = ({
  lawyer,
  slots,
  history,
  initialConsultationId = '',
  loading = false,
  error = '',
  preferredDate = null,
  onPreferredDateConsumed,
  onDatePicked,
  onSubmit,
}) => {
  const [step, setStep] = useState(0);
  const [linkedConsultationId, setLinkedConsultationId] = useState(initialConsultationId);
  const [caseDescription, setCaseDescription] = useState('');
  const [caseContextAttempted, setCaseContextAttempted] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [preferredStart, setPreferredStart] = useState<string | null>(null);

  const openSlots = useMemo(
    () => slots.filter((s) => preferredStartsInWindow(s.startTime, s.endTime, s.taken || []).length > 0),
    [slots],
  );

  const datesWithSlots = useMemo(() => {
    const set = new Set<string>();
    for (const s of openSlots) set.add(s.date.slice(0, 10));
    return [...set].sort();
  }, [openSlots]);

  const slotsForDate = useMemo(() => {
    if (!selectedDate) return [];
    return openSlots.filter((s) => s.date.slice(0, 10) === selectedDate);
  }, [openSlots, selectedDate]);

  const startsForDate = useMemo(() => {
    const rows: { slotId: string; start: string; holdUntil: string }[] = [];
    for (const s of slotsForDate) {
      for (const t of preferredStartsInWindow(s.startTime, s.endTime, s.taken || [])) {
        rows.push({ slotId: s.id, start: t, holdUntil: holdEnd(t, s.endTime) });
      }
    }
    return rows;
  }, [slotsForDate]);

  const hasCaseContext = hasBookingCaseContext({ consultationId: linkedConsultationId, caseDescription });

  useEffect(() => {
    if (!preferredDate) return;
    const day = preferredDate.slice(0, 10);
    if (!datesWithSlots.includes(day)) {
      onPreferredDateConsumed?.();
      return;
    }
    if (!hasCaseContext) {
      setCaseContextAttempted(true);
      onPreferredDateConsumed?.();
      return;
    }
    setSelectedDate(day);
    setSelectedSlotId(null);
    setPreferredStart(null);
    setStep(1);
    onPreferredDateConsumed?.();
  }, [preferredDate, datesWithSlots, hasCaseContext, onPreferredDateConsumed]);

  useEffect(() => {
    if (selectedDate) onDatePicked?.(selectedDate);
  }, [selectedDate, onDatePicked]);

  const goNext = () => {
    if (step === 0) {
      if (!hasCaseContext) {
        setCaseContextAttempted(true);
        return;
      }
      setStep(1);
      return;
    }
    if (!selectedSlotId || !preferredStart) return;
    onSubmit({
      availabilityId: selectedSlotId,
      preferredStartTime: preferredStart,
      consultationId: linkedConsultationId || undefined,
      caseDescription: caseDescription.trim() || undefined,
    });
  };

  return (
    <div className="staff-panel">
      <h2 className="staff-panel__title">Book consultation</h2>

      <div className="staff-wizard-progress" aria-label="Booking steps">
        {STEP_LABELS.map((label, i) => (
          <div
            key={label}
            className={`staff-wizard-progress__dot${i === step ? ' staff-wizard-progress__dot--active' : ''}${i < step ? ' staff-wizard-progress__dot--done' : ''}`}
          >
            <span className="staff-wizard-progress__num">{i < step ? '✓' : i + 1}</span>
            <span className="staff-wizard-progress__label">{label}</span>
          </div>
        ))}
      </div>

      <div className="consult-lawyer-mini">
        <UserAvatar avatarUrl={lawyer.avatarUrl} name={lawyer.name} size="md" />
        <div>
          <p className="consult-lawyer-mini__name">{lawyer.name}</p>
          <p className="consult-lawyer-mini__spec">
            {lawyer.specializations.slice(0, 2).join(' · ') || 'General practice'}
          </p>
        </div>
      </div>

      {error && <div className="staff-alert staff-alert--error">{error}</div>}

      {step === 0 && (
        <>
          <p className="staff-empty-hint" style={{ marginBottom: '0.75rem' }}>
            First, tell the lawyer about your case. After they review it, they will quote a fee —
            you pay with e-wallet or bank transfer to confirm the session
            {openSlots.length > 0 ? ` (${openSlots.length} open days)` : ''}.
          </p>

          <div className="staff-form-group">
            <label className="staff-form-label" htmlFor="citizen-consult-link">
              Past case identification (optional)
            </label>
            {history.length === 0 ? (
              <p className="staff-empty-hint">No past case identifications yet — use the description below.</p>
            ) : (
              <select
                id="citizen-consult-link"
                className="ox-input"
                value={linkedConsultationId}
                onChange={(e) => setLinkedConsultationId(e.target.value)}
              >
                <option value="">None</option>
                {history.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title || c.category || 'Untitled'} · {new Date(c.createdAt).toLocaleDateString()}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="staff-form-group">
            <label className="staff-form-label" htmlFor="citizen-case-desc">
              Case description
            </label>
            <textarea
              id="citizen-case-desc"
              className="ox-input"
              rows={4}
              maxLength={CASE_DESCRIPTION_MAX}
              placeholder="Briefly describe your situation so the lawyer can prepare."
              value={caseDescription}
              onChange={(e) => setCaseDescription(e.target.value)}
            />
          </div>

          {caseContextAttempted && !hasCaseContext && (
            <p className="staff-alert staff-alert--error">{bookingCaseContextError()}</p>
          )}

          {datesWithSlots.length === 0 && (
            <p className="staff-alert staff-alert--error">
              This lawyer has no open slots in the next 30 days. Try another lawyer or check back later.
            </p>
          )}
        </>
      )}

      {step === 1 && (
        <>
          <p className="staff-empty-hint" style={{ marginBottom: '0.75rem' }}>
            Pick a date and time from this lawyer&apos;s open hours. Each request holds 60 minutes; leftover time stays open.
          </p>

          <div className="staff-form-group">
            <label className="placer-field-label" htmlFor="pref-date">Preferred date *</label>
            <input
              id="pref-date"
              type="date"
              className="ox-input"
              min={datesWithSlots[0]}
              max={datesWithSlots[datesWithSlots.length - 1]}
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setSelectedSlotId(null);
                setPreferredStart(null);
              }}
            />
          </div>

          <div className="staff-form-group">
            <span className="placer-field-label">Time slot *</span>
            {!selectedDate ? (
              <p className="staff-empty-hint">Select a date first.</p>
            ) : startsForDate.length === 0 ? (
              <p className="staff-empty-hint">No open times on this date.</p>
            ) : (
              <div className="placer-time-grid" role="listbox" aria-label="Preferred start times">
                {startsForDate.map((row) => {
                  const active = selectedSlotId === row.slotId && preferredStart === row.start;
                  return (
                    <button
                      key={`${row.slotId}-${row.start}`}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`placer-time-pill${active ? ' is-selected' : ''}`}
                      onClick={() => {
                        setSelectedSlotId(row.slotId);
                        setPreferredStart(row.start);
                      }}
                    >
                      {row.start}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      <div className="staff-wizard-actions">
        {step > 0 && (
          <button type="button" className="ox-btn ox-btn-ghost" disabled={loading} onClick={() => setStep(0)}>
            Back
          </button>
        )}
        <button
          type="button"
          className="ox-btn ox-btn-primary"
          disabled={loading || (step === 0 && datesWithSlots.length === 0) || (step === 1 && (!selectedSlotId || !preferredStart))}
          onClick={goNext}
        >
          {loading ? 'Submitting…' : step === 0 ? 'Continue to date & time' : 'Confirm & Schedule'}
        </button>
      </div>
    </div>
  );
};

export default CitizenBookingWizard;
