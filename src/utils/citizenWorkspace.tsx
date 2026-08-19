import type { NavItem } from '../types';
import type { UserProfile } from '../services/api';
import { isCitizenBookingUnlocked } from './trustScore';

export const CITIZEN_DASHBOARD_PATH = '/dashboard';

export function getCitizenDashboardPath(): string {
  return CITIZEN_DASHBOARD_PATH;
}

export function getCitizenNav(userOrUnlocked: UserProfile | boolean | null | undefined = false): readonly NavItem[] {
  const unlocked = typeof userOrUnlocked === 'boolean'
    ? userOrUnlocked
    : isCitizenBookingUnlocked(userOrUnlocked);

  return [
    { label: 'Home', icon: 'home', path: CITIZEN_DASHBOARD_PATH },
    { label: 'Identify', icon: 'grid_view', path: '/ai-analysis' },
    { label: 'Schedule', icon: 'calendar_today', path: '/schedule-calendar', locked: !unlocked },
    { label: 'Directory', icon: 'gavel', path: '/directory', locked: !unlocked },
    { label: 'Settings', icon: 'settings', path: '/settings' },
  ];
}

/** Resolve stored upload paths for img src (Vite proxies /uploads in dev). */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return url;
  return `/${url.replace(/^\//, '')}`;
}
