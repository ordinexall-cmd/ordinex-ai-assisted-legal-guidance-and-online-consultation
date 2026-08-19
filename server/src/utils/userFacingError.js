/**
 * Map internal/ORM errors to short messages safe to show in the UI.
 */

const TECHNICAL_PATTERN =
  /prisma|invocation|Invalid\s+`|\bP\d{4}\b|ECONNREFUSED|ETIMEDOUT|column\s+.+\s+does not exist|SQLITE|query_engine|\.findUnique|\.findMany|stack trace|TypeError:|SyntaxError:|\bGroq\b|\bGemini\b|\bLlama\b|\bgpt-oss\b|\bOpenAI\b|\bAPI key\b|\bHTTP\b|llama-3|gemini-3|model `|AI unavailable|AI analysis failed/i;

function isTechnicalMessage(message) {
  if (!message || typeof message !== 'string') return true;
  const trimmed = message.trim();
  if (trimmed.length > 280) return true;
  return TECHNICAL_PATTERN.test(trimmed);
}

/**
 * Map AI provider failures to everyday language. Never mention vendors or model IDs.
 * @param {unknown} err
 * @returns {string}
 */
export function toAiUserFacingError(err) {
  const message = typeof err === 'string'
    ? err
    : err instanceof Error
      ? err.message
      : String(err || '');

  if (/today's limit|8:00 AM PHT|daily limits reset/i.test(message)) {
    return message;
  }
  if (
    /We're helping many people right now|Analysis is temporarily unavailable|We could not finish analyzing your situation|We could not finish the analysis/i.test(message)
    && !TECHNICAL_PATTERN.test(message)
  ) {
    return message;
  }
  if (/high demand|rate limit|too many requests|\b429\b|quota|capacity/i.test(message)) {
    return "We're helping many people right now. Please wait a minute and try again.";
  }
  if (/does not exist|do not have access|decommission|deprecated|model/i.test(message)) {
    return 'Analysis is temporarily unavailable while we update the service. Please try again in a few minutes.';
  }
  if (/not configured|API_KEY|unauthorized|\b401\b|invalid api/i.test(message)) {
    return 'Analysis is temporarily unavailable. Please try again later.';
  }
  if (/timeout|ETIMEDOUT|ECONNREFUSED|network|fetch failed|cannot reach/i.test(message)) {
    return 'We could not finish the analysis. Please check your connection and try again.';
  }
  return 'We could not finish analyzing your situation right now. Please try again in a few minutes.';
}

/**
 * @param {unknown} err
 * @param {string} [fallback]
 * @returns {string}
 */
export function toUserFacingError(err, fallback = 'Something went wrong. Please try again.') {
  if (typeof err === 'string') {
    if (/AI unavailable|AI analysis failed|Groq|Gemini|llama-|gpt-oss|high demand/i.test(err)) {
      return toAiUserFacingError(err);
    }
    return isTechnicalMessage(err) ? fallback : err;
  }

  const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
  const message = err instanceof Error ? err.message : '';

  if (code === 'P2002') {
    const field = err?.meta?.target?.[0];
    if (field === 'email') return 'An account with this email already exists. Log in instead.';
    if (field === 'phone') return 'An account with this phone number already exists. Log in instead.';
    return 'That value is already in use.';
  }

  if (code === 'P2025') {
    return 'We could not find that record.';
  }

  if (code === 'P1001' || /ECONNREFUSED|connect/i.test(message)) {
    return 'Cannot reach the server. Please try again shortly.';
  }

  if (/isAdmin|does not exist in the current database/i.test(message)) {
    return 'Log-in is temporarily unavailable. Please restart the API server and try again.';
  }

  if (/AI unavailable|AI analysis failed|Groq|Gemini|llama-|gpt-oss|high demand/i.test(message)) {
    return toAiUserFacingError(err);
  }

  if (isTechnicalMessage(message)) {
    return fallback;
  }

  return message || fallback;
}
