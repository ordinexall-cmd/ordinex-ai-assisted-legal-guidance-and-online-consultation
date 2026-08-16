import React from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../brand/BrandLogo';
import '../../styles/register-kiosk.css';

export interface RegisterKioskStepMeta {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
}

export interface RegisterKioskShellProps {
  readonly steps: readonly RegisterKioskStepMeta[];
  /** Index of the active wizard step (0-based). Use -1 for hub/done screens without progress. */
  readonly activeStepIndex: number;
  readonly title: string;
  readonly subtitle?: string;
  readonly kicker?: string;
  readonly children: React.ReactNode;
  readonly showFooter?: boolean;
  readonly onBack?: () => void;
  readonly onNext?: () => void;
  readonly backLabel?: string;
  readonly nextLabel?: string;
  readonly nextDisabled?: boolean;
  readonly nextLoading?: boolean;
  readonly hideBack?: boolean;
  readonly wide?: boolean;
  readonly footerExtra?: React.ReactNode;
  readonly role?: 'CITIZEN' | 'LAWYER';
}

export const RegisterKioskShell: React.FC<RegisterKioskShellProps> = ({
  steps,
  activeStepIndex,
  title,
  subtitle,
  kicker,
  children,
  showFooter = true,
  onBack,
  onNext,
  backLabel = 'Back',
  nextLabel = 'Continue',
  nextDisabled = false,
  nextLoading = false,
  hideBack = false,
  wide = false,
  footerExtra,
  role = 'CITIZEN',
}) => {
  const showProgress = activeStepIndex >= 0 && steps.length > 0;
  const pct = showProgress
    ? Math.round(((activeStepIndex + 1) / steps.length) * 100)
    : 0;

  return (
    <div className="reg-kiosk">
      <header className="reg-kiosk__top">
        <div className="reg-kiosk__brand">
          <Link to="/" className="reg-kiosk__brand-left">
            <BrandLogo size="sm" variant="onLight" showWordmark={false} />
            <span className="reg-kiosk__brand-label">Ordinex Registration</span>
          </Link>
          <Link to="/" className="reg-kiosk__brand-link" state={{ openLogin: true }}>
            Already have an account? Log in
          </Link>
        </div>
      </header>

      <main className="reg-kiosk__stage">
        <div className={`reg-kiosk__container${wide ? ' reg-kiosk__container--wide' : ''}`}>
          {/* Left Column: Institutional Context & Step Guide */}
          <aside className="reg-kiosk__sidebar">
            <div className="reg-kiosk__sidebar-header">
              <h2 className="reg-kiosk__sidebar-title">
                {role === 'LAWYER' ? 'Counsel Onboarding' : 'Citizen Registration'}
              </h2>
              <p className="reg-kiosk__sidebar-desc">
                {role === 'LAWYER'
                  ? 'Verify your Philippine Bar standing to offer consultations and accept online case bookings.'
                  : 'Create a free account to access AI pre-guidance, review legal outlines, and consult licensed counsel.'}
              </p>
            </div>

            {showProgress && (
              <div className="reg-kiosk__step-list" aria-label="Registration steps">
                {steps.map((s, i) => {
                  const isDone = i < activeStepIndex;
                  const isActive = i === activeStepIndex;
                  return (
                    <div
                      key={s.id}
                      className={`reg-kiosk__step-item${isActive ? ' is-active' : ''}${isDone ? ' is-done' : ''}`}
                    >
                      <div className="reg-kiosk__step-badge">
                        {isDone ? (
                          <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>check</span>
                        ) : (
                          <span>{i + 1}</span>
                        )}
                      </div>
                      <div className="reg-kiosk__step-info">
                        <span className="reg-kiosk__step-name">{s.label}</span>
                        {s.hint && <span className="reg-kiosk__step-hint">{s.hint}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="reg-kiosk__sidebar-policy">
              <div className="reg-kiosk__policy-card">
                <span className="material-symbols-outlined reg-kiosk__policy-icon">shield</span>
                <div>
                  <strong>RA 10173 Protected</strong>
                  <p>All credentials and case inputs are strictly encrypted under the Philippine Data Privacy Act.</p>
                </div>
              </div>
              <div className="reg-kiosk__policy-card">
                <span className="material-symbols-outlined reg-kiosk__policy-icon">lock</span>
                <div>
                  <strong>Escrow Security</strong>
                  <p>Client payments remain securely held until live consultation completion is confirmed.</p>
                </div>
              </div>
            </div>
          </aside>

          {/* Right Column: Form Card */}
          <div className="reg-kiosk__card-wrapper">
            <div className={`reg-kiosk__card${wide ? ' reg-kiosk__card--wide' : ''}`}>
              <div className="reg-kiosk__head">
                {kicker ? <p className="reg-kiosk__kicker">{kicker}</p> : null}
                <h1 className="reg-kiosk__title">{title}</h1>
                {subtitle ? <p className="reg-kiosk__subtitle">{subtitle}</p> : null}
                {showProgress ? (
                  <div className="reg-kiosk__progress-bar-container">
                    <div className="reg-kiosk__progress-bar" style={{ width: `${pct}%` }} />
                    <span className="reg-kiosk__progress-text">
                      Step {activeStepIndex + 1} of {steps.length} ({pct}%)
                    </span>
                  </div>
                ) : null}
              </div>
              {children}
            </div>
          </div>
        </div>
      </main>

      {showFooter && (
        <footer className="reg-kiosk__footer">
          {!hideBack && onBack ? (
            <button type="button" className="ox-btn ox-btn-ghost" onClick={onBack} disabled={nextLoading}>
              {backLabel}
            </button>
          ) : (
            <span className="reg-kiosk__footer-spacer" aria-hidden />
          )}
          {footerExtra}
          {onNext ? (
            <button
              type="button"
              className="ox-btn ox-btn-primary"
              onClick={onNext}
              disabled={nextDisabled || nextLoading}
            >
              {nextLoading ? 'Please wait…' : nextLabel}
            </button>
          ) : null}
        </footer>
      )}
    </div>
  );
};

export default RegisterKioskShell;
