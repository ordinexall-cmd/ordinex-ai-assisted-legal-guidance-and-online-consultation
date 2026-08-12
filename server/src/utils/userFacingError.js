/**
 * Map internal/ORM errors to short messages safe to show in the UI.
 */

const TECHNICAL_PATTERN =
  /prisma|invocation|Invalid\s+`|\bP\d{4}\b|ECONNREFUSED|ETIMEDOUT|column\s+.+\s+does not exist|SQLITE|query_engine|\.findUnique|\.findMany|stack trace|TypeError:|SyntaxError:/i;

function isTechnicalMessage(message) {
  if (!message || typeof message !== 'string') return true;
  const trimmed = message.trim();
  if (trimmed.length > 280) return true;
  return TECHNICAL_PATTERN.test(trimmed);
}

/**
 * @param {unknown} err
 * @param {string} [fallback]
 * @returns {string}
 */
export function toUserFacingError(err, fallback = 'Something went wrong. Please try again.') {
  if (typeof err === 'string') {
    return isTechnicalMessage(err) ? fallback : err;
  }

  const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
  const message = err instanceof Error ? err.message : '';

  if (code === 'P2002') {
    const field = err?.meta?.target?.[0];
    if (field === 'email') return 'An account with this email already exists.';
    if (field === 'phone') return 'An account with this phone number already exists.';
    return 'That value is already in use.';
  }

  if (code === 'P2025') {
    return 'We could not find that record.';
  }

  if (code === 'P1001' || /ECONNREFUSED|connect/i.test(message)) {
    return 'Cannot reach the server. Please try again shortly.';
  }

  if (/isAdmin|does not exist in the current database/i.test(message)) {
    return 'Sign-in is temporarily unavailable. Please restart the API server and try again.';
  }

  if (isTechnicalMessage(message)) {
    return fallback;
  }

  return message || fallback;
}
