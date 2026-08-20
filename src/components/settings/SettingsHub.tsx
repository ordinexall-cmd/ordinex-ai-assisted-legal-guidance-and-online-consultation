import React from 'react';
import { UserAvatar } from '../UserAvatar';

export type SettingsSection =
  | 'profile'
  | 'verification'
  | 'security'
  | 'subscription'
  | 'privacy'
  | 'records'
  | 'recycle'
  | 'history';

interface SettingsHubProps {
  readonly isLawyer: boolean;
  readonly userName: string;
  readonly avatarUrl: string | null;
  readonly phoneVerified: boolean;
  readonly isVerifiedLawyer?: boolean;
  readonly onSelect: (section: SettingsSection) => void;
}

interface RowProps {
  readonly title: string;
  readonly description?: string;
  readonly meta?: React.ReactNode;
  readonly onClick: () => void;
  readonly lead?: React.ReactNode;
}

function SettingsHubRow({ title, description, meta, onClick, lead }: RowProps) {
  return (
    <button type="button" className="settings-hub-row" onClick={onClick}>
      {lead ? <span className="settings-hub-row__lead">{lead}</span> : null}
      <span className="settings-hub-row__body">
        <strong className="settings-hub-row__title">{title}</strong>
        {description ? <span className="settings-hub-row__desc">{description}</span> : null}
      </span>
      {meta ? <span className="settings-hub-row__meta">{meta}</span> : null}
      <span className="settings-hub-row__chevron" aria-hidden>›</span>
    </button>
  );
}

function SettingsGroup({
  label,
  description,
  children,
}: {
  readonly label: string;
  readonly description?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="settings-group">
      <div className="settings-group__intro">
        <h3 className="settings-group__label">{label}</h3>
        {description ? <p className="settings-group__desc">{description}</p> : null}
      </div>
      <div className="settings-group__card">{children}</div>
    </section>
  );
}

export const SettingsHub: React.FC<SettingsHubProps> = ({
  isLawyer,
  userName,
  avatarUrl,
  phoneVerified,
  isVerifiedLawyer,
  onSelect,
}) => (
  <div className="settings-ac">
    <div className="settings-group__card settings-ac__profile">
      <SettingsHubRow
        title="Profile"
        description="Photo, display name, and personal details"
        lead={<UserAvatar avatarUrl={avatarUrl} name={userName} size="md" />}
        meta={<span className="settings-hub-row__meta-name">{userName}</span>}
        onClick={() => onSelect('profile')}
      />
    </div>

    <SettingsGroup
      label="Account"
      description="Identity and how you appear on Ordinex."
    >
      <SettingsHubRow
        title="Verification"
        description="Manage identity verification and contact details."
        meta={phoneVerified ? (
          <span className="settings-hub-row__verified">Verified</span>
        ) : (
          <span className="settings-hub-row__pending">Pending</span>
        )}
        onClick={() => onSelect('verification')}
      />
      {isLawyer ? (
        <SettingsHubRow
          title="Practice"
          description="Directory listing, specializations, and counsel verification."
          meta={isVerifiedLawyer ? (
            <span className="settings-hub-row__verified">Verified</span>
          ) : (
            <span className="settings-hub-row__pending">In progress</span>
          )}
          onClick={() => onSelect('verification')}
        />
      ) : null}
    </SettingsGroup>

    <SettingsGroup
      label="Security & privacy"
      description="Manage sign-in and how your data is used."
    >
      <SettingsHubRow
        title="Security"
        description="Password and account security."
        onClick={() => onSelect('security')}
      />
      <SettingsHubRow
        title="Privacy"
        description="Control how your data is used and shared."
        onClick={() => onSelect('privacy')}
      />
    </SettingsGroup>

    <SettingsGroup
      label="Billing & data"
      description="Payments, consultation history, and deleted items."
    >
      {!isLawyer ? (
        <SettingsHubRow
          title="Billing"
          description="E-wallet or bank for checkout — no platform subscription."
          meta={<span className="settings-hub-row__plan-label">Pay per consult</span>}
          onClick={() => onSelect('subscription')}
        />
      ) : null}
      <SettingsHubRow
        title="History"
        description="View past case identifications and consultation records."
        onClick={() => onSelect('history')}
      />
      <SettingsHubRow
        title="Consultation records"
        description="Past consultations and record settings."
        onClick={() => onSelect('records')}
      />
      <SettingsHubRow
        title="Recycle Bin"
        description="Restore deleted case identifications and consultations within 7 days."
        onClick={() => onSelect('recycle')}
      />
    </SettingsGroup>
  </div>
);

export default SettingsHub;
