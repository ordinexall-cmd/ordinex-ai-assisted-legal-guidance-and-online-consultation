import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSideNav } from '../../context/SideNavContext';
import { NotificationBell } from '../NotificationBell';
import { goAppBack } from '../../utils/navigation';

export interface AppTopRibbonProps {
  readonly title: string;
  readonly stepLabel?: string;
  readonly backTo?: string;
  readonly backLabel?: string;
  readonly actions?: React.ReactNode;
  readonly showNotifications?: boolean;
  readonly locked?: boolean;
}

export const AppTopRibbon: React.FC<AppTopRibbonProps> = ({
  title,
  stepLabel,
  backTo,
  backLabel = 'Back',
  actions,
  showNotifications = true,
  locked = false,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toggle } = useSideNav();

  const displayName = user?.name?.trim() || 'Account';

  return (
    <header className="pao-top-ribbon">
      <div className="staff-ribbon__title-wrap">
        <button
          type="button"
          className="ox-ribbon-menu"
          onClick={toggle}
          aria-label="Open menu"
        >
          Menu
        </button>
        {backTo ? (
          <button
            type="button"
            className="ox-ribbon-back"
            onClick={() => goAppBack(navigate, backTo)}
          >
            {backLabel}
          </button>
        ) : null}
        <h2 className="staff-ribbon__title">
          {locked ? <span className="ox-sr-only">Locked. Verification required. </span> : null}
          {locked ? (
            <span className="material-symbols-outlined staff-ribbon__lock" aria-hidden>
              lock
            </span>
          ) : null}
          {title}
          {stepLabel ? (
            <>
              {' '}
              <span className="staff-ribbon__step">/ {stepLabel}</span>
            </>
          ) : null}
        </h2>
      </div>
      <div className="staff-ribbon__actions">
        {actions}
        {showNotifications && user ? (
          <NotificationBell className="staff-notify__trigger" />
        ) : null}
        {user ? (
          <span className="staff-ribbon__name" title={displayName}>{displayName}</span>
        ) : null}
      </div>
    </header>
  );
};

export default AppTopRibbon;
