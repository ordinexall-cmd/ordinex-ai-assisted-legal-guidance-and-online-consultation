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
    const apiErr = err as Error & { status?: number; data?: any };
    if (apiErr.data && typeof apiErr.data.error === 'string' && !isTechnicalMessage(apiErr.data.error)) {
      return apiErr.data.error;
    }
    if (apiErr.message && !isTechnicalMessage(apiErr.message)) {
      return apiErr.message;
    }
    if (apiErr.status === 0) {
      return 'API server is not running. Please check your connection.';
    }
    if (apiErr.status === 401) {
      return 'Invalid credentials. Please check your email and password.';
    }
    if (apiErr.status === 403) return 'You do not have access to do that.';
    if (apiErr.status === 404) return 'We could not find what you were looking for.';
    if (apiErr.status === 409) {
      if (typeof apiErr.data?.error === 'string' && !isTechnicalMessage(apiErr.data.error)) {
        return apiErr.data.error;
      }
      return 'An account with this email or phone already exists. Log in instead.';
    }
    if (apiErr.status === 413) return 'The file is too large. Maximum size is 10MB.';
  }

  const message = err instanceof Error ? err.message : '';

  if (/isAdmin|does not exist in the current database/i.test(message)) {
    return 'Log-in is temporarily unavailable. Please try again in a moment.';
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
