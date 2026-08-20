import React from 'react';
import { useNavigate } from 'react-router-dom';

export interface JoinVideoButtonProps {
  bookingId: string;
  canJoin: boolean;
  hint: string;
  readyText?: string;
  hintId?: string;
  fullWidth?: boolean;
}

export const JoinVideoButton: React.FC<JoinVideoButtonProps> = ({
  bookingId,
  canJoin,
  hint,
  readyText = 'You will confirm device access and the recording/transcript policy before entering the private video room.',
  hintId = 'join-video-hint',
  fullWidth = true,
}) => {
  const navigate = useNavigate();
  return (
    <>
      <p
        id={hintId}
        className="booking-join-video-hint"
        role="status"
        aria-live="polite"
      >
        {canJoin ? readyText : hint}
      </p>
      <button
        type="button"
        disabled={!canJoin}
        aria-describedby={hintId}
        onClick={() => {
          if (canJoin) navigate(`/consultation/${bookingId}/preflight`);
        }}
        className={`ox-btn ox-btn-primary booking-join-video-btn${fullWidth ? ' booking-join-video-btn--full' : ''}`}
        title={canJoin ? undefined : hint}
      >
        <span className="material-symbols-outlined" aria-hidden>
          {canJoin ? 'videocam' : 'videocam_off'}
        </span>
        Join Video Call
      </button>
    </>
  );
};
