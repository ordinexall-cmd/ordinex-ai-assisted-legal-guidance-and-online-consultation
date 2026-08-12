import React from 'react';

interface DashSettingsIntroProps {
  readonly isLawyer: boolean;
  readonly isVerifiedLawyer?: boolean;
  readonly phoneVerified?: boolean;
  readonly showProfilePreview?: boolean;
  readonly onToggleProfilePreview?: () => void;
}

export const DashSettingsIntro: React.FC<DashSettingsIntroProps> = ({
  isLawyer,
  isVerifiedLawyer,
  phoneVerified = true,
  showProfilePreview,
  onToggleProfilePreview,
}) => {
  const status = [
    phoneVerified ? 'Identity verified' : null,
    !isLawyer ? 'Citizen account' : null,
    isLawyer && isVerifiedLawyer ? 'Verified counsel' : null,
    isLawyer && !isVerifiedLawyer ? 'Verification in progress' : null,
  ].filter(Boolean).join(' · ');

  return (
    <header className="settings-ac-intro">
      <h1 className="settings-ac-intro__title">Accounts Center</h1>
      <p className="settings-ac-intro__desc">
        Manage your Ordinex profile, security, and account preferences in one place.
      </p>
      {status ? <p className="settings-ac-intro__status">{status}</p> : null}
      {onToggleProfilePreview ? (
        <div className="settings-ac-intro__actions">
          <button
            type="button"
            className="staff-ribbon__signout"
            onClick={onToggleProfilePreview}
            aria-expanded={showProfilePreview}
          >
            {showProfilePreview ? 'Hide profile preview' : 'View profile preview'}
          </button>
        </div>
      ) : null}
    </header>
  );
};

export default DashSettingsIntro;
