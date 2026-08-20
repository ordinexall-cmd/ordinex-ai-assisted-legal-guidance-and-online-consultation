import React, { useEffect, useState } from 'react';
import { availabilityApi, bookingsApi, lawyersApi, type Booking } from '../../services/api';
import { getErrorMessage } from '../../utils/userFacingError';

interface SlotOption {
  id: string;
  label: string;
}

export interface BookingRescheduleModalProps {
  booking: Booking;
  onClose: () => void;
  onRescheduled: (booking: Booking) => void;
}

export const BookingRescheduleModal: React.FC<BookingRescheduleModalProps> = ({
  booking,
  onClose,
  onRescheduled,
}) => {
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const from = new Date().toISOString().slice(0, 10);
        const toDate = new Date();
        toDate.setDate(toDate.getDate() + 60);
        const to = toDate.toISOString().slice(0, 10);
        const isCitizen = booking.viewerRole === 'CITIZEN';

        if (isCitizen) {
          const { slots: raw } = await lawyersApi.getAvailability(booking.lawyer.id, from, to);
          const options: SlotOption[] = [];
          for (const s of raw) {
            const dateStr = new Date(s.date).toLocaleDateString('en-PH', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            });
            const openStarts = (s as { openStarts?: string[] }).openStarts || [];
            for (const start of openStarts) {
              options.push({ id: s.id, label: `${dateStr}, ${start}–${s.endTime}` });
            }
          }
          setSlots(options);
        } else {
          const { slots: raw } = await availabilityApi.getMy(from, to);
          setSlots(
            raw
              .filter((s) => !s.isBooked || s.id === booking.availabilityId)
              .map((s) => ({
                id: s.id,
                label: `${new Date(s.date).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })}, ${s.startTime}–${s.endTime}`,
              })),
          );
        }
      } catch (e: unknown) {
        setError(getErrorMessage(e, 'Could not load available slots.'));
      } finally {
        setLoading(false);
      }
    })();
  }, [booking]);

  const submit = async () => {
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      const { booking: updated } = await bookingsApi.reschedule(booking.id, selected);
      onRescheduled(updated);
      onClose();
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Could not reschedule.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="reschedule-title">
      <div className="ox-card modal-card booking-reschedule-modal">
        <h3 id="reschedule-title" className="booking-action-card__title">Reschedule consultation</h3>
        <p className="booking-action-card__text">Pick a new open slot with the same lawyer.</p>
        {loading ? (
          <p className="booking-action-card__text">Loading slots…</p>
        ) : slots.length === 0 ? (
          <p className="booking-action-card__text" role="status">No open slots found. Try again later or cancel for a refund.</p>
        ) : (
          <select
            className="ox-select"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            aria-label="New consultation slot"
          >
            <option value="">Select a slot…</option>
            {slots.map((s) => (
              <option key={`${s.id}-${s.label}`} value={s.id}>{s.label}</option>
            ))}
          </select>
        )}
        {error && <p className="booking-reschedule-modal__error" role="alert">{error}</p>}
        <div className="booking-reschedule-modal__actions">
          <button type="button" className="ox-btn ox-btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="ox-btn ox-btn-primary"
            disabled={saving || !selected}
            onClick={() => { void submit(); }}
          >
            Confirm reschedule
          </button>
        </div>
      </div>
    </div>
  );
};
