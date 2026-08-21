import React, { useMemo, useState } from 'react';
import {
  CONSULT_OFFER_DURATIONS,
  OFFER_MESSAGE_MAX,
  OFFER_MESSAGE_MIN,
  consultDurationLabel,
  type ConsultOfferDuration,
} from '../../utils/consultOffer';

const peso = (n: number) => `₱${n.toLocaleString()}`;

export interface ConsultOfferPayload {
  readonly message: string;
  readonly durationMinutes: ConsultOfferDuration;
  readonly quotedFee?: number;
}

interface ConsultOfferFormProps {
  readonly feeMin: number;
  readonly feeMax: number;
  readonly busy?: boolean;
  readonly error?: string;
  readonly submitLabel?: string;
  readonly onCancel?: () => void;
  readonly onSubmit: (payload: ConsultOfferPayload) => void;
}

export const ConsultOfferForm: React.FC<ConsultOfferFormProps> = ({
  feeMin,
  feeMax,
  busy = false,
  error = '',
  submitLabel = 'Send offer',
  onCancel,
  onSubmit,
}) => {
  const [message, setMessage] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<ConsultOfferDuration>(60);
  const [quotedFeeInput, setQuotedFeeInput] = useState('');
  const isFree = feeMax <= 0;
  const parsedFee = parseFloat(quotedFeeInput) || 0;
  const feeValid = isFree || (parsedFee >= feeMin && parsedFee <= feeMax && parsedFee > 0);
  const messageOk = message.trim().length >= OFFER_MESSAGE_MIN && message.trim().length <= OFFER_MESSAGE_MAX;

  const hint = useMemo(() => {
    if (isFree) return 'Your profile lists this consult as free.';
    if (feeMin === feeMax) return `Your profile fee is ${peso(feeMin)}. Quote that exact amount.`;
    return `Your profile range is ${peso(feeMin)} – ${peso(feeMax)}. Quote the exact fee for this citizen.`;
  }, [feeMin, feeMax, isFree]);

  return (
    <>
      <label className="ox-label" htmlFor="consult-offer-detail">Details / description</label>
      <textarea
        id="consult-offer-detail"
        className="ox-input"
        rows={3}
        maxLength={OFFER_MESSAGE_MAX}
        placeholder="What this consult will cover, how you would handle their concern, and anything they should prepare."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <p className="staff-empty-hint">
        {message.trim().length}/{OFFER_MESSAGE_MAX} · at least {OFFER_MESSAGE_MIN} characters. Chat still opens only after they book and pay.
      </p>

      <p className="ox-label" style={{ marginTop: 10 }}>Duration</p>
      <div className="staff-slot-chips" role="group" aria-label="Session duration">
        {CONSULT_OFFER_DURATIONS.map((mins) => (
          <button
            key={mins}
            type="button"
            className={`ox-btn ox-btn-sm ${durationMinutes === mins ? 'ox-btn-primary' : 'ox-btn-ghost'}`}
            onClick={() => setDurationMinutes(mins)}
          >
            {consultDurationLabel(mins)}
          </button>
        ))}
      </div>

      {!isFree && (
        <div className="quote-input-section" style={{ marginTop: 12 }}>
          <label className="ox-label" htmlFor="consult-offer-fee">Exact consultation fee</label>
          <div className="quote-input-row">
            <span className="quote-input-row__prefix">₱</span>
            <input
              id="consult-offer-fee"
              className="ox-input quote-input-row__input"
              type="number"
              min={feeMin}
              max={feeMax}
              step="1"
              placeholder={`${feeMin.toLocaleString()} – ${feeMax.toLocaleString()}`}
              value={quotedFeeInput}
              onChange={(e) => setQuotedFeeInput(e.target.value)}
            />
          </div>
          <p className="staff-empty-hint">{hint}</p>
          {parsedFee > 0 && !feeValid && (
            <p className="landing-form-error">Fee must be between {peso(feeMin)} and {peso(feeMax)}.</p>
          )}
        </div>
      )}
      {isFree && <p className="staff-empty-hint" style={{ marginTop: 10 }}>{hint}</p>}

      {error && <p className="landing-form-error">{error}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="ox-btn ox-btn-primary"
          disabled={busy || !messageOk || !feeValid}
          onClick={() => {
            onSubmit({
              message: message.trim(),
              durationMinutes,
              quotedFee: isFree ? undefined : parsedFee,
            });
          }}
        >
          {busy ? 'Sending…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="ox-btn ox-btn-ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </>
  );
};
