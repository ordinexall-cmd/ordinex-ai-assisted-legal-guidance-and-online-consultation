import React, { useState } from 'react';
import { bookingsApi, type Booking } from '../../services/api';

interface Props {
  readonly booking: Booking;
  readonly peerName: string;
  readonly onRemoved: (id: string) => void;
}

export const BookingHistoryRowActions: React.FC<Props> = ({ booking, peerName, onRemoved }) => {
  const [busy, setBusy] = useState(false);

  const remove = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Move consultation with ${peerName} to Recycle Bin? You can restore it within 7 days.`)) {
      return;
    }
    setBusy(true);
    try {
      await bookingsApi.removeFromHistory(booking.id);
      onRemoved(booking.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className="ox-btn-ghost-icon"
      title="Move to Recycle Bin"
      disabled={busy}
      onClick={(e) => void remove(e)}
      aria-label="Move to Recycle Bin"
    >
      <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--color-ox-error)' }}>delete</span>
    </button>
  );
};

export default BookingHistoryRowActions;
