import React from 'react';

export interface ProfileCompletionCalloutProps {
  readonly isLawyer: boolean;
  readonly isVerified: boolean;
  readonly score: number;
  readonly userName: string;
  readonly onAction: () => void;
  readonly onDismiss?: () => void;
  readonly className?: string;
}

export const ProfileCompletionCallout: React.FC<ProfileCompletionCalloutProps> = ({
  isLawyer,
  isVerified,
  score,
  userName,
  onAction,
  onDismiss,
  className = '',
}) => {
  const firstName = userName.split(' ')[0] || 'there';

  if (isLawyer && isVerified) return null;
  if (!isLawyer && score >= 80) return null;

  return (
    <div
      className={`profile-completion-callout ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        padding: '1rem 1.25rem',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        marginTop: '1rem',
        marginBottom: '1.25rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: isLawyer ? '#eff6ff' : '#ecfdf5',
            color: isLawyer ? '#2563eb' : '#059669',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>
            {isLawyer ? 'gavel' : 'verified_user'}
          </span>
        </div>

        <div>
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#1e293b' }}>
            {isLawyer
              ? `${firstName}, complete your Supreme Court & ID verification`
              : `${firstName}, you aren't fully verified yet`}
          </h4>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            {isLawyer
              ? 'Verified attorneys get an official Supreme Court Trust badge and appear at the top of the directory.'
              : 'Complete your Philippine domicile & ID to unlock direct lawyer matching and consultation booking.'}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        <button
          type="button"
          className="ox-btn ox-btn-primary ox-btn-sm"
          onClick={onAction}
          style={{ whiteSpace: 'nowrap' }}
        >
          {isLawyer ? 'Verify now' : 'Complete profile'}
        </button>
        {onDismiss && (
          <button
            type="button"
            className="ox-btn ox-btn-ghost ox-btn-sm"
            onClick={onDismiss}
            aria-label="Dismiss"
            style={{ padding: '4px' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        )}
      </div>
    </div>
  );
};
