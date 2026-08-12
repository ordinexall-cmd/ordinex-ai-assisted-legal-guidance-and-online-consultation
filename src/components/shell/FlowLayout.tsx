import React from 'react';
import { AppSideNav } from './AppSideNav';
import { AppTopRibbon } from './AppTopRibbon';
import type { NavItem } from '../../types';

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
