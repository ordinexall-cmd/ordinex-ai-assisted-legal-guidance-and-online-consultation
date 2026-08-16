import React, { useCallback, useEffect, useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSideNav } from '../../context/SideNavContext';
import { BrandLogo } from '../brand/BrandLogo';
import { UserAvatar } from '../UserAvatar';
import type { NavItem } from '../../types';

interface AppSideNavProps {
  readonly navItems: readonly NavItem[];
}

function accountLabel(isLawyer: boolean): string {
  return isLawyer ? 'Lawyer account' : 'Citizen account';
}

function markFromLabel(label: string): string {
  const parts = label.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return label.slice(0, 2).toUpperCase();
}

function useMobileNav(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    const update = () => setMobile(mq.matches);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return mobile;
}

export const AppSideNav: React.FC<AppSideNavProps> = ({ navItems }) => {
  const { logout, user } = useAuth();
  const { expanded, toggle, setExpanded } = useSideNav();
  const navigate = useNavigate();
  const mobile = useMobileNav();

  const mainItems = navItems.filter((i) => i.path !== '/settings');
  const isLawyer = user?.role === 'LAWYER';
  const firstName = user?.name?.split(' ')[0] || 'Account';
  const showLabels = mobile || expanded;
  const collapsed = mobile ? !expanded : !expanded;

  const closeDrawer = useCallback(() => {
    if (mobile) setExpanded(false);
  }, [mobile, setExpanded]);

  React.useEffect(() => {
    document.body.classList.add('ox-portal');
    return () => document.body.classList.remove('ox-portal');
  }, []);

  React.useEffect(() => {
    if (!mobile || !expanded) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [mobile, expanded]);

  const renderItem = (item: NavItem, key: string) => {
    const end =
      item.path === '/dashboard'
      || item.path === '/lawyer/dashboard';

    const inner = (
      <>
        {!showLabels ? (
          <span className="pao-side-nav-mark" aria-hidden>{markFromLabel(item.label)}</span>
        ) : null}
        {showLabels ? <span>{item.label}</span> : null}
        {item.locked ? (
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '15px', color: '#94a3b8', marginLeft: showLabels ? 'auto' : 0 }}
            title="Profile verification required"
            aria-hidden
          >
            lock
          </span>
        ) : null}
      </>
    );

    return (
      <NavLink
        key={key}
        to={item.path}
        end={end}
        className={({ isActive }) =>
          `pao-side-nav-link${isActive ? ' active' : ''}${item.locked ? ' is-locked' : ''}`
        }
        title={!showLabels ? `${item.label}${item.locked ? ' (Verification required)' : ''}` : undefined}
        aria-label={item.label}
        onClick={closeDrawer}
      >
        {inner}
      </NavLink>
    );
  };

  return (
    <>
      {mobile && expanded ? (
        <button
          type="button"
          className="pao-side-nav-backdrop"
          aria-label="Close navigation"
          onClick={closeDrawer}
        />
      ) : null}

      <aside
        className={`pao-side-nav${collapsed ? ' collapsed' : ''}${mobile ? ' pao-side-nav--mobile' : ''}${mobile && expanded ? ' pao-side-nav--open' : ''}`}
        aria-label="Main navigation"
        aria-hidden={mobile ? !expanded : undefined}
      >
        <div className="pao-side-nav-header">
          {showLabels ? (
            <Link to="/" className="pao-side-nav-logo-area" onClick={closeDrawer}>
              <BrandLogo size="sm" variant="onDark" showWordmark={false} />
              <div className="pao-side-nav-title">
                <span>Ordinex</span>
                <span>Legal platform</span>
              </div>
            </Link>
          ) : (
            <Link to="/" className="pao-side-nav-logo-area" style={{ justifyContent: 'center', width: '100%' }} onClick={closeDrawer}>
              <BrandLogo size="sm" variant="onDark" showWordmark={false} />
            </Link>
          )}
          <button
            type="button"
            className="pao-side-nav-toggle"
            onClick={toggle}
            aria-label={expanded ? 'Close navigation' : 'Open navigation'}
            aria-expanded={expanded}
          >
            <span className="pao-side-nav-toggle-label">
              {mobile ? 'Close' : (collapsed ? 'Open' : 'Hide')}
            </span>
          </button>
        </div>

        <nav className="pao-side-nav-links">
          {mainItems.map((item, i) => renderItem(item, `${item.path}-${i}`))}
        </nav>

        <div className="pao-side-nav-footer">
          {renderItem(
            { label: 'Settings', icon: 'settings', path: '/settings' },
            'settings',
          )}

          {showLabels && user ? (
            <Link to="/settings" className="pao-side-nav-footer-row" style={{ textDecoration: 'none', color: 'inherit' }} onClick={closeDrawer}>
              <UserAvatar avatarUrl={user.avatarUrl} name={user.name} size="md" className="sidenav-avatar" />
              <div className="pao-side-nav-footer-info">
                <span className="pao-side-nav-footer-name">{firstName}</span>
                <span className="pao-side-nav-footer-role">{accountLabel(isLawyer)}</span>
              </div>
            </Link>
          ) : !showLabels && user ? (
            <Link to="/settings" className="pao-side-nav-link" aria-label="Account settings" onClick={closeDrawer}>
              <UserAvatar avatarUrl={user.avatarUrl} name={user.name} size="md" className="sidenav-avatar" />
            </Link>
          ) : null}

          <button
            type="button"
            className="pao-side-nav-link"
            onClick={() => { logout(); navigate('/'); closeDrawer(); }}
            aria-label="Log out"
          >
            <span className="material-symbols-outlined" aria-hidden>logout</span>
            {!showLabels ? <span className="pao-side-nav-mark" aria-hidden>LO</span> : null}
            {showLabels ? <span>Log out</span> : null}
          </button>
        </div>
      </aside>
    </>
  );
};

export default AppSideNav;
