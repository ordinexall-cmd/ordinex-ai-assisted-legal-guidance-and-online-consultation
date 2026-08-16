import React from 'react';
import { useLocation } from 'react-router-dom';
import { AppSideNav } from './AppSideNav';
import { AppTopRibbon } from './AppTopRibbon';
import type { NavItem } from '../../types';

function navItemLocked(navItems: readonly NavItem[], pathname: string): boolean {
  return navItems.some((item) => item.locked && (pathname === item.path || pathname.startsWith(`${item.path}/`)));
}

interface FlowLayoutProps {
  readonly navItems: readonly NavItem[];
  readonly title: string;
  readonly stepLabel?: string;
  readonly backTo?: string;
  readonly backLabel?: string;
  readonly headerActions?: React.ReactNode;
  readonly showNotifications?: boolean;
  readonly children: React.ReactNode;
}

export const FlowLayout: React.FC<FlowLayoutProps> = ({
  navItems,
  title,
  stepLabel,
  backTo,
  backLabel = 'Back',
  headerActions,
  showNotifications = true,
  children,
}) => {
  const { pathname } = useLocation();
  const locked = navItemLocked(navItems, pathname);

  return (
    <div className="ox-portal-wrapper">
      <div className="ox-portal__body">
        <AppSideNav navItems={navItems} />
        <div className="ox-content-area">
          <AppTopRibbon
            title={title}
            stepLabel={stepLabel}
            backTo={backTo}
            backLabel={backLabel}
            actions={headerActions}
            showNotifications={showNotifications}
            locked={locked}
          />
          <main className="page-container">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

export default FlowLayout;
