/** First name or short label for shell header. */
export function displayFirstName(fullName?: string | null, fallback = 'User'): string {
  if (!fullName?.trim()) return fallback;
  return fullName.trim().split(/\s+/)[0];
}
