import React from 'react';
import { AppSideNav } from './AppSideNav';
import { AppTopRibbon } from './AppTopRibbon';
import { useAuth } from '../../context/AuthContext';
import type { NavItem } from '../../types';

interface AppLayoutProps {
  readonly title: string;
  readonly description?: string;
  readonly navItems: readonly NavItem[];
  readonly headerActions?: React.ReactNode;
  readonly pageActions?: React.ReactNode;
  readonly hidePageHeader?: boolean;
  readonly children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  title,
  navItems,
  headerActions,
  pageActions,
  hidePageHeader = false,
  children,
}) => {
  const { user } = useAuth();
  const ribbonActions = headerActions ?? pageActions;

  return (
    <div className="ox-portal-wrapper">
      <div className="ox-portal__body">
        <AppSideNav navItems={navItems} />
        <div className="ox-content-area">
          {(user || !hidePageHeader) && (
            <AppTopRibbon
              title={title}
              actions={ribbonActions}
              showNotifications={Boolean(user)}
            />
          )}
          <main id="main-content" className="page-container" tabIndex={-1}>
            <div className={`page-stack${hidePageHeader ? ' page-stack--dashboard' : ''}`}>
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default AppLayout;
