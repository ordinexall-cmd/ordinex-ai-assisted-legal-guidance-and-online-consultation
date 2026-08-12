import type { NavItem } from '../types';

export const lawyerNav: readonly NavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', path: '/lawyer/dashboard' },
  { label: 'Schedule Calendar', icon: 'calendar_today', path: '/lawyer/schedule' },
  { label: 'History', icon: 'history', path: '/lawyer/history' },
  { label: 'Settings', icon: 'settings', path: '/settings' },
];
