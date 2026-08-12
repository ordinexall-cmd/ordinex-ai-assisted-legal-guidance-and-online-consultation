import React from 'react';
import { AppLayout } from './AppLayout';
import { FlowLayout } from './FlowLayout';
import type { NavItem } from '../../types';

interface AppShellProps {
  readonly title: string;
  readonly description?: string;
  readonly navItems: readonly NavItem[];
  readonly variant?: 'standard' | 'flow';
  readonly stepLabel?: string;
  readonly backTo?: string;
  readonly backLabel?: string;
  readonly userName?: string;
  readonly badge?: React.ReactNode;
  readonly headerActions?: React.ReactNode;
  readonly pageActions?: React.ReactNode;
  readonly hidePageHeader?: boolean;
  readonly children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  title,
  description,
  navItems,
  variant = 'standard',
  stepLabel,
  backTo,
  backLabel,
  headerActions,
  pageActions,
  hidePageHeader,
  children,
}) => {
  if (variant === 'flow') {
    return (
      <FlowLayout
        navItems={navItems}
        title={title}
        stepLabel={stepLabel}
        backTo={backTo}
        backLabel={backLabel}
        headerActions={headerActions}
      >
        {children}
      </FlowLayout>
    );
  }

  return (
    <AppLayout
      title={title}
      description={description}
      navItems={navItems}
      headerActions={headerActions}
      pageActions={pageActions ?? undefined}
      hidePageHeader={hidePageHeader}
    >
      {children}
    </AppLayout>
  );
};

export default AppShell;
