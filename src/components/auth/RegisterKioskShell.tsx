import React from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../brand/BrandLogo';
import '../../styles/register-kiosk.css';

export interface RegisterKioskStepMeta {
  readonly id: string;
  readonly label: string;
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
            <span className="reg-kiosk__brand-label">Ordinex registration</span>
          </Link>
          <Link to="/" className="reg-kiosk__brand-link" state={{ openLogin: true }}>
            Sign in
          </Link>
        </div>
        {showProgress && (
          <div className="reg-kiosk__steps" aria-label="Registration progress">
            {steps.map((s, i) => (
              <div
                key={s.id}
                className={`reg-kiosk__step${i === activeStepIndex ? ' is-active' : ''}${i < activeStepIndex ? ' is-done' : ''}`}
              >
                <span className="reg-kiosk__step-dot" aria-hidden />
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </header>

      <main className="reg-kiosk__stage">
        <div className={`reg-kiosk__stage-inner${wide ? ' reg-kiosk__card--wide' : ''}`}>
          <div className={`reg-kiosk__card${wide ? ' reg-kiosk__card--wide' : ''}`}>
            <div className="reg-kiosk__head">
              {kicker ? <p className="reg-kiosk__kicker">{kicker}</p> : null}
              <h1 className="reg-kiosk__title">{title}</h1>
              {subtitle ? <p className="reg-kiosk__subtitle">{subtitle}</p> : null}
              {showProgress ? (
                <p className="reg-kiosk__progress-text">
                  Step {activeStepIndex + 1} of {steps.length} · {pct}% complete
                </p>
              ) : null}
            </div>
            {children}
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
