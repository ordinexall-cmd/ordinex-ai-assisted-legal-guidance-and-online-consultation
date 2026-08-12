import React from 'react';

export interface DashPageHeaderProps {
  readonly title: React.ReactNode;
  readonly subtitle?: React.ReactNode;
  readonly aside?: React.ReactNode;
  readonly icon?: React.ReactNode;
  readonly className?: string;
  /** @deprecated Notifications live only in AppTopRibbon. Ignored. */
  readonly showNotifications?: boolean;
}

export const DashPageHeader: React.FC<DashPageHeaderProps> = ({
  title,
  subtitle,
  aside,
  icon,
  className = '',
}) => {
  const toolbar = aside ? (
    <div className="dash-page-header__toolbar">{aside}</div>
  ) : null;

  return (
    <header className={`dash-page-header${className ? ` ${className}` : ''}`}>
      <div className="dash-page-header__main">
        {icon ? <div className="dash-page-header__icon">{icon}</div> : null}
        <div className="dash-page-header__text">
          <h1 className="dash-page-header__title">{title}</h1>
          {subtitle ? <p className="dash-page-header__subtitle">{subtitle}</p> : null}
        </div>
      </div>
      {toolbar}
    </header>
  );
};

export default DashPageHeader;
