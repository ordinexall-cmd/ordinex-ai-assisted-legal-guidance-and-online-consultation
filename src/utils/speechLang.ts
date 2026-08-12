/** Map profile language to translation target codes. */
export function normalizeTranslateLang(userLang?: string): string {
  const c = (userLang || 'en').toLowerCase();
  if (c === 'fil') return 'tl';
  if (c === 'ceb') return 'ceb';
  if (c.startsWith('en')) return 'en';
  return c.slice(0, 5);
}

/** Map user.language to BCP-47 for Web Speech API (free, browser, no API key). */
export function speechRecognitionLang(userLang?: string): string {
  const c = (userLang || 'en').toLowerCase();
  if (c === 'fil' || c === 'tl') return 'fil-PH';
  if (c === 'ceb') return 'fil-PH'; // Cebuano not natively supported; use Filipino as best-effort
  if (c.startsWith('en')) return 'en-US';
  if (c.startsWith('es')) return 'es-ES';
  return 'en-US';
}

