import React from 'react';
import type { UserProfile } from '../../services/api';
import { UserAvatar } from '../UserAvatar';
import { LawyerPracticeBadge } from '../lawyer/LawyerPracticeBadge';
import { ProfileStrengthCard } from '../profile/ProfileStrengthCard';
import { computeUserCompleteness } from '../../utils/profileCompleteness';

const peso = (n: number | null | undefined) =>
  n == null ? 'Ask' : n === 0 ? 'Free' : `₱${n.toLocaleString()}`;

interface LawyerProfilePreviewProps {
  readonly user: UserProfile;
  readonly draftName?: string;
  readonly draftBio?: string;
}

/** Read-only preview of how the lawyer appears in the citizen directory. */
export const LawyerProfilePreview: React.FC<LawyerProfilePreviewProps> = ({
  user,
  draftName,
  draftBio,
}) => {
  const previewUser = {
    ...user,
    name: draftName?.trim() || user.name,
    bio: draftBio?.trim() || user.bio,
  };
  const completeness = computeUserCompleteness(previewUser);

  return (
    <div className="settings-profile-preview ox-card" role="region" aria-label="Public profile preview">
      <p className="settings-profile-preview__label">Preview — citizen directory</p>
      <div className="settings-profile-preview__hero">
        <UserAvatar avatarUrl={user.avatarUrl} name={previewUser.name} size="lg" />
        <div>
          <div className="settings-profile-preview__name-row">
            <h3 className="settings-profile-preview__name">{previewUser.name}</h3>
            {user.isVerified && (
              <span className="material-symbols-outlined lawyer-card__verified" title="Verified">verified</span>
            )}
            <LawyerPracticeBadge practiceType={user.practiceType} />
          </div>
          <p className="profile-email">
            {(user.specializations ?? []).join(' · ') || 'General practice'}
          </p>
          <p className="profile-email">Consultation fee: {peso(user.consultationFee)}</p>
        </div>
      </div>
      {previewUser.bio && (
        <p className="settings-profile-preview__bio">{previewUser.bio}</p>
      )}
      <ProfileStrengthCard completeness={completeness} title="Trust profile" />
    </div>
  );
};

export default LawyerProfilePreview;
