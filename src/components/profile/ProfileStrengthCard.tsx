import React from 'react';
import {
  completenessFillBackground,
  completenessScoreColor,
  type ProfileCompleteness,
} from '../../utils/profileCompleteness';

interface ProfileStrengthCardProps {
  readonly completeness: ProfileCompleteness;
  readonly title?: string;
  readonly className?: string;
  readonly collapsibleChecklist?: boolean;
}

export const ProfileStrengthCard: React.FC<ProfileStrengthCardProps> = ({
  completeness,
  title = 'Profile strength',
  className = '',
  collapsibleChecklist = false,
}) => {
  const { score, checks } = completeness;
  const scoreColor = completenessScoreColor(score);
  const doneCount = checks.filter((c) => c.done).length;

  const checklist = (
    <ul className="lawyer-trust-card__list">
      {checks.map((c) => (
        <li key={c.label} className={c.done ? 'is-done' : ''}>
          <span className="lawyer-trust-card__mark" aria-hidden>{c.done ? 'Done' : '—'}</span>
          <span>{c.label}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className={`ox-card profile-strength-card lawyer-trust-card${className ? ` ${className}` : ''}`}>
      <div className="lawyer-trust-card__head">
        <h3 className="lawyer-section-title">{title}</h3>
        <span className="lawyer-trust-card__score" style={{ color: scoreColor }}>
          {score}% complete
        </span>
      </div>
      <div className="lawyer-trust-card__track">
        <div
          className="lawyer-trust-card__fill"
          style={{
            width: `${score}%`,
            background: completenessFillBackground(score),
          }}
        />
      </div>
      {collapsibleChecklist ? (
        <details className="profile-strength-details">
          <summary className="profile-strength-details__summary">
            Checklist ({doneCount}/{checks.length} complete)
          </summary>
          {checklist}
        </details>
      ) : (
        checklist
      )}
    </div>
  );
};

export default ProfileStrengthCard;
