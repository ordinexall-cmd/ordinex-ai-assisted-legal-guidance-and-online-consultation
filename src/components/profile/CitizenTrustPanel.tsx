import React from 'react';
import { Link } from 'react-router-dom';
import { UserAvatar } from '../UserAvatar';
import { ProfileStrengthCard } from './ProfileStrengthCard';
import { computeCitizenCompleteness, type CitizenProfileInput } from '../../utils/profileCompleteness';

export interface CitizenTrustSubject extends CitizenProfileInput {
  readonly id: string;
  readonly createdAt?: string;
}

interface CitizenTrustPanelProps {
  readonly citizen: CitizenTrustSubject;
  readonly caseDescription?: string | null;
  readonly consultationId?: string | null;
  readonly onClose?: () => void;
  readonly previewMode?: boolean;
}

export const CitizenTrustPanel: React.FC<CitizenTrustPanelProps> = ({
  citizen,
  caseDescription,
  consultationId,
  onClose,
  previewMode = false,
}) => {
  const completeness = computeCitizenCompleteness(citizen);
  const memberSince = citizen.createdAt
    ? new Date(citizen.createdAt).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="citizen-trust-panel ox-card" role="region" aria-label="Client profile">
      <div className="citizen-trust-panel__head">
        <h3 className="lawyer-section-title">{previewMode ? 'Your client profile preview' : 'Client profile'}</h3>
        {onClose && (
          <button type="button" className="header-back-btn citizen-trust-panel__close" onClick={onClose} aria-label="Close">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        )}
      </div>

      <div className="citizen-trust-panel__identity">
        <UserAvatar avatarUrl={citizen.avatarUrl ?? undefined} name={citizen.name ?? 'Client'} size="lg" />
        <div>
          <p className="citizen-trust-panel__name">{citizen.name || 'Client'}</p>
          {memberSince && <p className="profile-email">Member since {memberSince}</p>}
        </div>
      </div>

      <ProfileStrengthCard completeness={completeness} title="Client verification readiness" />

      {previewMode && !caseDescription && (
        <p className="profile-email citizen-trust-panel__preview-hint">
          Case notes from each booking appear here when a lawyer reviews your request.
        </p>
      )}

      {caseDescription && (
        <div className="citizen-trust-panel__case">
          <p className="settings-section-title">Case context</p>
          <p className="citizen-trust-panel__case-text">{caseDescription}</p>
        </div>
      )}

      {consultationId && (
        <p className="citizen-trust-panel__ai-link">
          <Link to={`/ai-analysis?id=${consultationId}`} className="link-inline">
            View linked case identification
          </Link>
        </p>
      )}

      {!previewMode && (
        <p className="citizen-trust-panel__note profile-email">
          Limited view for this booking only. Contact details are not shown here.
        </p>
      )}
    </div>
  );
};

export default CitizenTrustPanel;
