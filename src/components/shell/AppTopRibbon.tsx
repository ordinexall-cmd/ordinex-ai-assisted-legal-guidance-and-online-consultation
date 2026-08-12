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
}

export const AppTopRibbon: React.FC<AppTopRibbonProps> = ({
  title,
  stepLabel,
  backTo,
  backLabel = 'Back',
  actions,
  showNotifications = true,
}) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { toggle } = useSideNav();

  const displayName = user?.name?.trim() || 'Account';

  const handleSignOut = () => {
    logout();
    navigate('/');
  };

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
        {user && (
          <div className="staff-ribbon__user">
            <span className="staff-ribbon__name" title={displayName}>{displayName}</span>
            <button
              type="button"
              className="staff-ribbon__signout"
              onClick={handleSignOut}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default AppTopRibbon;
