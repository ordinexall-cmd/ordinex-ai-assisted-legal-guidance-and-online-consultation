import React from 'react';
import { bookingsApi, type Booking } from '../../services/api';
import '../../styles/consultation-chromeless.css';

export interface ConsultationPostCallProps {
  readonly booking: Booking;
  readonly uploading?: boolean;
  readonly onDownloadTranscript?: () => void;
  readonly onOpenBooking: () => void;
  readonly onBack: () => void;
}

export const ConsultationPostCall: React.FC<ConsultationPostCallProps> = ({
  booking,
  uploading = false,
  onDownloadTranscript,
  onOpenBooking,
  onBack,
}) => {
  const hasRecording = Boolean(booking.recordingUrl);
  const hasTranscript = Boolean(booking.hasTranscript);

  return (
    <div className="consult-chromeless consult-chromeless--center">
      <div className="consult-postcall">
        <h3>Session ended</h3>
        <p className="consult-postcall__lead">
          Your consultation with{' '}
          {booking.viewerRole === 'CITIZEN' ? booking.lawyer.name : booking.citizen.name}{' '}
          has ended. Recording and transcript are available to both parties on this booking.
        </p>
        <ul>
          <li>
            Recording:{' '}
            {hasRecording
              ? 'Ready'
              : uploading
                ? 'Uploading…'
                : 'Usually ready within about a minute'}
          </li>
          <li>
            Transcript:{' '}
            {hasTranscript
              ? 'Available on the booking'
              : 'Live notes and edits stay on the booking page'}
          </li>
        </ul>
        <div className="consult-postcall__actions">
          {hasRecording && (
            <button
              type="button"
              className="consult-chromeless__btn consult-chromeless__btn--gold"
              onClick={async () => {
                try {
                  const token = localStorage.getItem('ordinex_token');
                  const res = await fetch(bookingsApi.downloadRecordingUrl(booking.id), {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                  });
                  if (!res.ok) throw new Error('download failed');
                  const blob = await res.blob();
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = `consultation-${booking.id.slice(0, 8)}.webm`;
                  a.click();
                  URL.revokeObjectURL(a.href);
                } catch {
                  onOpenBooking();
                }
              }}
            >
              Download recording
            </button>
          )}
          {(onDownloadTranscript || hasTranscript) && (
            <button
              type="button"
              className="consult-chromeless__btn"
              onClick={async () => {
                if (onDownloadTranscript) {
                  onDownloadTranscript();
                  return;
                }
                try {
                  const { plainText } = await bookingsApi.getTranscript(booking.id);
                  const blob = new Blob([plainText || ''], { type: 'text/plain;charset=utf-8' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = `consultation-${booking.id.slice(0, 8)}-transcript.txt`;
                  a.click();
                  URL.revokeObjectURL(a.href);
                } catch {
                  onOpenBooking();
                }
              }}
            >
              Download transcript
            </button>
          )}
          <button
            type="button"
            className="consult-chromeless__btn consult-chromeless__btn--primary"
            onClick={onOpenBooking}
          >
            Open booking
          </button>
          <button type="button" className="consult-chromeless__btn" onClick={onBack}>
            Back to dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConsultationPostCall;
