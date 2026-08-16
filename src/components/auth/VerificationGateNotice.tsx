import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { computeCitizenTrustScore, computeLawyerTrustScore } from '../../utils/trustScore';

export interface VerificationGateNoticeProps {
  readonly title?: string;
  readonly featureName?: string;
  readonly onAction?: () => void;
}

export const VerificationGateNotice: React.FC<VerificationGateNoticeProps> = ({
  title = 'Profile Verification Required',
  featureName,
  onAction,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isLawyer = user?.role === 'LAWYER';
  const resolvedFeature = featureName
    || (isLawyer ? 'Directory and consultation offers' : 'Directory and consultation booking');
  const dashboardPath = isLawyer ? '/lawyer/dashboard' : '/dashboard';
  const trust = isLawyer
    ? computeLawyerTrustScore(user || {})
    : computeCitizenTrustScore(user || {});

  const handleComplete = () => {
    if (onAction) {
      onAction();
    } else {
      navigate('/settings?tab=verification');
    }
  };

  return (
    <div className="verification-gate-notice">
      <div className="verification-gate-notice__icon-wrap" aria-hidden>
        <span className="material-symbols-outlined" style={{ fontSize: '36px' }}>
          lock
        </span>
      </div>

      <h1 className="verification-gate-notice__title">{title}</h1>

      <p className="verification-gate-notice__lead">
        Access to <strong>{resolvedFeature}</strong> unlocks at Trust 100 / 100. Finish the remaining checks below.
      </p>

      <div className="verification-gate-notice__checklist">
        <h2>Verification checklist ({trust.score} / 100)</h2>
        <ul className="verification-gate-notice__list">
          {trust.checks.map((check) => (
            <li key={check.id} className="verification-gate-notice__item">
              <span
                className="material-symbols-outlined"
                aria-hidden
                style={{ color: check.verified ? 'var(--color-ox-success)' : 'var(--color-ox-text-muted)', fontSize: '20px' }}
              >
                {check.verified ? 'check_circle' : 'radio_button_unchecked'}
              </span>
              <span>
                {check.label}
                <span className="verification-gate-notice__item-desc">
                  {check.points}/{check.maxPoints} · {check.description}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="verification-gate-notice__actions">
        <button
          type="button"
          className="ox-btn ox-btn-primary"
          onClick={handleComplete}
        >
          Complete profile verification
        </button>
        <button
          type="button"
          className="ox-btn ox-btn-ghost"
          onClick={() => navigate(dashboardPath)}
        >
          Return to dashboard
        </button>
      </div>
    </div>
  );
};

export default VerificationGateNotice;
