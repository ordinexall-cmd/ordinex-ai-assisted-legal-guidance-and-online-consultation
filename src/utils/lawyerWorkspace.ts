import type { NavItem } from '../types';

export function getLawyerNav(user?: { isVerified?: boolean } | null): readonly NavItem[] {
  const practiceLocked = !user?.isVerified;
  return [
    { label: 'Dashboard', icon: 'dashboard', path: '/lawyer/dashboard' },
    { label: 'Directory', icon: 'group', path: '/directory', locked: practiceLocked },
    { label: 'Schedule Calendar', icon: 'calendar_today', path: '/lawyer/schedule' },
    { label: 'Settings', icon: 'settings', path: '/settings' },
  ];
}

/** Unlocked default; prefer getLawyerNav(user) in screens. */
export const lawyerNav: readonly NavItem[] = getLawyerNav({ isVerified: true });
