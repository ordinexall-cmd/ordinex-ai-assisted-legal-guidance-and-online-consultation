import React from 'react';
import { DashPageHeader } from './DashPageHeader';

function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

interface DashWelcomeProps {
  readonly userName: string;
  readonly subtitle: React.ReactNode;
  readonly aside?: React.ReactNode;
}

export const DashWelcome: React.FC<DashWelcomeProps> = ({
  userName,
  subtitle,
  aside,
}) => (
  <DashPageHeader
    title={`${timeGreeting()}, ${userName}`}
    subtitle={subtitle}
    aside={aside}
  />
);
