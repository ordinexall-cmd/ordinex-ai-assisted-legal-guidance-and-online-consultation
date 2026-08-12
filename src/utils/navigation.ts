import type { NavigateFunction } from 'react-router-dom';
import { getCitizenDashboardPath } from './citizenWorkspace';

/** Back target for flow pages when history is empty. */
export function getAppBackFallback(isLawyer: boolean): string {
  if (isLawyer) return '/lawyer/dashboard';
  return getCitizenDashboardPath();
}

/** Prefer browser back; fall back to a known route when history is empty. */
export function goAppBack(navigate: NavigateFunction, fallback: string): void {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    navigate(-1);
    return;
  }
  navigate(fallback);
}
