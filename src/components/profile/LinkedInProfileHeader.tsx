import React from 'react';
import { UserAvatar } from '../UserAvatar';

export interface LinkedInProfileHeaderProps {
  readonly name: string;
  readonly role: 'CITIZEN' | 'LAWYER';
  readonly avatarUrl?: string | null;
  readonly isVerified?: boolean;
  readonly trustScore: number;
  readonly headline?: string | null;
  readonly location?: string | null;
  readonly practiceType?: string | null;
  readonly barNumber?: string | null;
  readonly onEditProfile?: () => void;
  readonly onUploadAvatar?: () => void;
  readonly onVerifyNow?: () => void;
  readonly isOwnProfile?: boolean;
}

export const LinkedInProfileHeader: React.FC<LinkedInProfileHeaderProps> = ({
  name,
  role,
  avatarUrl,
  isVerified = false,
  headline,
  location,
  barNumber,
  onEditProfile,
  onUploadAvatar,
  onVerifyNow,
  isOwnProfile = true,
}) => {
  const isLawyer = role === 'LAWYER';

  return (
    <div
      className="linkedin-profile-header ox-card"
      style={{
        padding: 0,
        overflow: 'hidden',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        background: '#ffffff',
        marginBottom: '1.5rem',
      }}
    >
      {/* Cover Banner */}
      <div
        style={{
          height: '140px',
          background: isLawyer
            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e3a8a 100%)'
            : 'linear-gradient(135deg, #0f766e 0%, #047857 50%, #064e3b 100%)',
          position: 'relative',
        }}
      >
        {isOwnProfile && (
          <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
            <span
              style={{
                fontSize: '0.75rem',
                color: 'rgba(255, 255, 255, 0.75)',
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '4px 10px',
                borderRadius: '9999px',
                backdropFilter: 'blur(4px)',
              }}
            >
              {isLawyer ? 'Philippine Legal Counsel' : 'Verified Citizen'}
            </span>
          </div>
        )}
      </div>

      {/* Avatar & Main Profile Details */}
      <div style={{ padding: '0 1.5rem 1.5rem', position: 'relative' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginTop: '-60px',
            marginBottom: '1rem',
          }}
        >
          <div style={{ position: 'relative' }}>
            <div
              style={{
                padding: '4px',
                background: '#ffffff',
                borderRadius: '50%',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
              }}
            >
              <UserAvatar avatarUrl={avatarUrl || undefined} name={name} size="lg" />
            </div>

            {onUploadAvatar && isOwnProfile && (
              <button
                type="button"
                onClick={onUploadAvatar}
                title="Change photo"
                style={{
                  position: 'absolute',
                  bottom: '4px',
                  right: '4px',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: '#0f172a',
                  color: '#ffffff',
                  border: '2px solid #ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>photo_camera</span>
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {isOwnProfile && onEditProfile && (
              <button
                type="button"
                className="ox-btn ox-btn-ghost ox-btn-sm"
                onClick={onEditProfile}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
                Edit profile
              </button>
            )}

            {isOwnProfile && !isVerified && onVerifyNow && (
              <button
                type="button"
                className="ox-btn ox-btn-primary ox-btn-sm"
                onClick={onVerifyNow}
              >
                {isLawyer ? 'Verify counsel' : 'Complete intake'}
              </button>
            )}
          </div>
        </div>

        {/* Identity & Badges */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: '#0f172a' }}>{name}</h2>
            {isVerified && (
              <span
                className="material-symbols-outlined"
                style={{ color: '#059669', fontSize: '22px' }}
                title="Verified"
              >
                verified
              </span>
            )}
          </div>

          {isLawyer && barNumber && (
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
              Roll of Attorneys No. {barNumber}
            </p>
          )}

          {headline && (
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem', color: '#334155', lineHeight: 1.4 }}>
              {headline}
            </p>
          )}

          {location && (
            <p
              style={{
                margin: '0.4rem 0 0',
                fontSize: '0.8rem',
                color: '#64748b',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>location_on</span>
              {location}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
