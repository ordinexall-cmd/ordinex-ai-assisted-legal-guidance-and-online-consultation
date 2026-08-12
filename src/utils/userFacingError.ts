/**
 * Sanitize API and thrown errors before showing them in the UI.
 */

const TECHNICAL_PATTERN =
  /prisma|invocation|Invalid\s+`|\bP\d{4}\b|ECONNREFUSED|ETIMEDOUT|column\s+.+\s+does not exist|SQLITE|query_engine|\.findUnique|\.findMany|stack trace|TypeError:|SyntaxError:/i;

function isTechnicalMessage(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return true;
  if (trimmed.length > 280) return true;
  return TECHNICAL_PATTERN.test(trimmed);
}

export function toUserFacingError(
  err: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (typeof err === 'string') {
    return isTechnicalMessage(err) ? fallback : err;
  }

  if (err instanceof Error && err.name === 'ApiError') {
    const apiErr = err as Error & { status?: number };
    if (apiErr.status === 0) {
      return err.message && !isTechnicalMessage(err.message)
        ? err.message
        : 'API server is not running. Start it with npm run server:dev.';
    }
    if (apiErr.status === 401) {
      return err.message && !isTechnicalMessage(err.message)
        ? err.message
        : 'You need to sign in again.';
    }
    if (apiErr.status === 403) return err.message && !isTechnicalMessage(err.message) ? err.message : 'You do not have access to do that.';
    if (apiErr.status === 404) return err.message && !isTechnicalMessage(err.message) ? err.message : 'We could not find what you were looking for.';
    if (apiErr.status === 409) return err.message && !isTechnicalMessage(err.message) ? err.message : 'That action could not be completed.';
    if (apiErr.status === 413) return 'The file is too large. Maximum size is 10MB.';
  }

  const message = err instanceof Error ? err.message : '';

  if (/isAdmin|does not exist in the current database/i.test(message)) {
    return 'Sign-in is temporarily unavailable. Please try again in a moment.';
  }

  if (isTechnicalMessage(message)) {
    return fallback;
  }

  return message || fallback;
}

/** Use in catch blocks instead of `e.message`. */
export function getErrorMessage(err: unknown, fallback?: string): string {
  return toUserFacingError(err, fallback);
}
