/**
 * Sanitize API and thrown errors before showing them in the UI.
 */

const TECHNICAL_PATTERN =
  /prisma|invocation|Invalid\s+`|\bP\d{4}\b|ECONNREFUSED|ETIMEDOUT|column\s+.+\s+does not exist|SQLITE|query_engine|\.findUnique|\.findMany|stack trace|TypeError:|SyntaxError:|\bGroq\b|\bGemini\b|\bLlama\b|\bgpt-oss\b|\bOpenAI\b|\bAPI key\b|llama-3|gemini-3|model `|AI unavailable|AI analysis failed/i;

function isTechnicalMessage(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return true;
  if (trimmed.length > 280) return true;
  return TECHNICAL_PATTERN.test(trimmed);
}

function toAiUserFacingError(raw: string): string {
  if (/today's limit|8:00 AM PHT|daily limits reset/i.test(raw)) return raw;
  if (
    /We're helping many people right now|Analysis is temporarily unavailable|We could not finish analyzing your situation|We could not finish the analysis/i.test(raw)
    && !TECHNICAL_PATTERN.test(raw)
  ) {
    return raw;
  }
  if (/high demand|rate limit|too many requests|\b429\b|quota|capacity/i.test(raw)) {
    return "We're helping many people right now. Please wait a minute and try again.";
  }
  if (/does not exist|do not have access|decommission|deprecated|model/i.test(raw)) {
    return 'Analysis is temporarily unavailable while we update the service. Please try again in a few minutes.';
  }
  if (/not configured|API_KEY|unauthorized|\b401\b|invalid api/i.test(raw)) {
    return 'Analysis is temporarily unavailable. Please try again later.';
  }
  if (/timeout|ETIMEDOUT|ECONNREFUSED|network|fetch failed|cannot reach/i.test(raw)) {
    return 'We could not finish the analysis. Please check your connection and try again.';
  }
  return 'We could not finish analyzing your situation right now. Please try again in a few minutes.';
}

export function toUserFacingError(
  err: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (typeof err === 'string') {
    if (/AI unavailable|AI analysis failed|Groq|Gemini|llama-|gpt-oss|high demand/i.test(err)) {
      return toAiUserFacingError(err);
    }
    return isTechnicalMessage(err) ? fallback : err;
  }

  if (err instanceof Error && err.name === 'ApiError') {
    const apiErr = err as Error & { status?: number; data?: any };
    const apiMsg = typeof apiErr.data?.error === 'string' ? apiErr.data.error : '';
    if (apiMsg && /AI unavailable|AI analysis failed|Groq|Gemini|llama-|gpt-oss|high demand|model `/i.test(apiMsg)) {
      return toAiUserFacingError(apiMsg);
    }
    if (apiMsg && !isTechnicalMessage(apiMsg)) {
      return apiMsg;
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

  if (/AI unavailable|AI analysis failed|Groq|Gemini|llama-|gpt-oss|high demand/i.test(message)) {
    return toAiUserFacingError(message);
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
