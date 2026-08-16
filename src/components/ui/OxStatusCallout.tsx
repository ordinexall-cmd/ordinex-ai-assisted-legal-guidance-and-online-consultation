import React from 'react';

interface OxStatusCalloutProps {
  readonly variant: 'verify' | 'warn';
  readonly icon?: string;
  readonly title: string;
  readonly children?: React.ReactNode;
  readonly action?: React.ReactNode;
}

export const OxStatusCallout: React.FC<OxStatusCalloutProps> = ({
  variant,
  icon = 'verified_user',
  title,
  children,
  action,
}) => (
  <div className={`ox-callout ox-callout--${variant}`} role="status">
    <div className="ox-callout__main">
      <span className="material-symbols-outlined ox-callout__icon" aria-hidden>
        {icon}
      </span>
      <div className="ox-callout__copy">
        <p className="ox-callout__title">{title}</p>
        {children ? <div className="ox-callout__body">{children}</div> : null}
      </div>
    </div>
    {action ? <div className="ox-callout__action">{action}</div> : null}
  </div>
);

export default OxStatusCallout;
