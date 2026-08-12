import type { NavItem } from '../types';

export const CITIZEN_DASHBOARD_PATH = '/dashboard';

export function getCitizenDashboardPath(): string {
  return CITIZEN_DASHBOARD_PATH;
}

export function getCitizenNav(): readonly NavItem[] {
  return [
    { label: 'Home', icon: 'home', path: CITIZEN_DASHBOARD_PATH },
    { label: 'Analysis', icon: 'grid_view', path: '/ai-analysis' },
    { label: 'History', icon: 'history', path: '/history' },
    { label: 'Schedule', icon: 'calendar_today', path: '/schedule-calendar' },
    { label: 'Lawyers', icon: 'gavel', path: '/lawyers' },
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
