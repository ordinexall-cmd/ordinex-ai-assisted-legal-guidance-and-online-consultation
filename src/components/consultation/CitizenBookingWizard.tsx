import React, { useEffect, useMemo, useState } from 'react';
import type { AvailabilitySlot, ConsultationResult, LawyerProfile } from '../../services/api';
import { hasBookingCaseContext, bookingCaseContextError } from '../../utils/bookingCaseContext';
import { holdEnd } from '../../utils/sessionOverlap';

const CASE_DESCRIPTION_MAX = 2000;

const STEP_LABELS = ['Case context', 'Pick a slot'];

function formatSlotDate(isoDate: string): string {
  return new Date(`${isoDate.slice(0, 10)}T12:00:00`).toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

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
  onSubmit,
}) => {
  const [step, setStep] = useState(0);
  const [linkedConsultationId, setLinkedConsultationId] = useState(initialConsultationId);
  const [caseDescription, setCaseDescription] = useState('');
  const [caseContextAttempted, setCaseContextAttempted] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [preferredStart, setPreferredStart] = useState<string | null>(null);

  const openSlots = useMemo(() => slots.filter((s) => (s.openStarts?.length ?? 0) > 0 || !s.isBooked), [slots]);

  const datesWithSlots = useMemo(() => {
    const set = new Set<string>();
    for (const s of openSlots) set.add(s.date.slice(0, 10));
    return [...set].sort();
  }, [openSlots]);

  const slotsForDate = useMemo(() => {
    if (!selectedDate) return [];
    return openSlots.filter((s) => s.date.slice(0, 10) === selectedDate);
  }, [openSlots, selectedDate]);

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

  const goNext = () => {
    if (step === 0) {
      if (!hasCaseContext) {
        setCaseContextAttempted(true);
        return;
      }
      if (!selectedDate && datesWithSlots.length > 0) {
        setSelectedDate(datesWithSlots[0]);
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
        <div className="consult-lawyer-mini__avatar">
          {lawyer.avatarUrl ? (
            <img src={lawyer.avatarUrl} alt="" />
          ) : (
            <span className="material-symbols-outlined">person</span>
          )}
        </div>
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
            you pay with GCash to confirm the session
            {openSlots.length > 0 ? ` (${openSlots.length} open days)` : ''}.
          </p>

          <div className="staff-form-group">
            <label className="staff-form-label" htmlFor="citizen-consult-link">
              Past AI analysis (optional)
            </label>
            {history.length === 0 ? (
              <p className="staff-empty-hint">No past analyses yet — use the description below.</p>
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
            Choose a date, then a start time inside the lawyer&apos;s open hours. Your request holds 60 minutes. Other people can still book leftover time the same day.
          </p>

          <div className="staff-form-group">
            <span className="staff-form-label">Available dates</span>
            {datesWithSlots.length === 0 ? (
              <p className="staff-empty-hint" style={{ color: 'var(--color-ox-error)' }}>
                No open slots in the next 30 days.
              </p>
            ) : (
              <div className="staff-slot-chips" role="listbox" aria-label="Available dates">
                {datesWithSlots.map((d) => (
                  <button
                    key={d}
                    type="button"
                    role="option"
                    aria-selected={selectedDate === d}
                    className={`staff-slot-chip${selectedDate === d ? ' staff-slot-chip--active' : ''}`}
                    onClick={() => {
                      setSelectedDate(d);
                      setSelectedSlotId(null);
                      setPreferredStart(null);
                    }}
                  >
                    {formatSlotDate(d)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="staff-form-group">
            <span className="staff-form-label">Start time</span>
            {!selectedDate ? (
              <p className="staff-empty-hint">Select a date above.</p>
            ) : slotsForDate.length === 0 ? (
              <p className="staff-empty-hint">No open hours on this date.</p>
            ) : (
              slotsForDate.map((s) => {
                const starts = s.openStarts?.length ? s.openStarts : [s.startTime];
                return (
                  <div key={s.id} style={{ marginBottom: '0.75rem' }}>
                    <p className="staff-empty-hint" style={{ marginBottom: '0.4rem' }}>
                      Open {s.startTime}–{s.endTime}
                    </p>
                    <div className="staff-slot-chips" role="listbox" aria-label="Preferred start times">
                      {starts.map((t) => {
                        const active = selectedSlotId === s.id && preferredStart === t;
                        return (
                          <button
                            key={`${s.id}-${t}`}
                            type="button"
                            role="option"
                            aria-selected={active}
                            className={`staff-slot-chip${active ? ' staff-slot-chip--active' : ''}`}
                            onClick={() => {
                              setSelectedSlotId(s.id);
                              setPreferredStart(t);
                            }}
                          >
                            {t}–{holdEnd(t, s.endTime)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
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
          {loading ? 'Submitting…' : step === 0 ? 'Continue to date & time' : 'Send booking request'}
        </button>
      </div>
    </div>
  );
};

export default CitizenBookingWizard;
