import { ApiError } from '../services/api';

/** User-facing message when a list/dashboard fetch fails. */
export function loadErrorMessage(err: unknown, fallback = 'Could not load data. Check your connection and try again.'): string {
  if (err instanceof ApiError) {
    if (err.status === 0) {
      return 'Cannot reach the server. Start the Ordinex API (port 5000) and refresh.';
    }
    return err.message || fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
