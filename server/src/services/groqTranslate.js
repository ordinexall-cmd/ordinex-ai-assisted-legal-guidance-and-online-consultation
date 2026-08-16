/**
 * Booking chat translation — Unified LLM (Groq 8B primary, Gemini 2.5 Flash fallback).
 */
import { llmChat } from './llmClient.js';
import { env } from '../config/env.js';

const LANG_NAMES = {
  en: 'English',
  tl: 'Tagalog',
  fil: 'Tagalog',
  ceb: 'Cebuano',
  es: 'Spanish',
};

const SUPPORTED = [
  { code: 'en', name: 'English' },
  { code: 'tl', name: 'Tagalog' },
  { code: 'ceb', name: 'Cebuano' },
  { code: 'es', name: 'Spanish' },
];

/** Check whether any translation backend is available. */
export function isTranslateAvailable() {
  return Boolean(env.GROQ_API_KEYS.length > 0 || env.GROQ_API_KEY || env.GEMINI_API_KEYS.length > 0 || env.GEMINI_API_KEY);
}

export function getTranslateLanguages() {
  return SUPPORTED;
}

function mapLang(code) {
  const c = (code || 'en').toLowerCase();
  if (c === 'fil') return 'tl';
  if (c.startsWith('en')) return 'en';
  return c.slice(0, 5);
}

/**
 * Translate chat message using Groq light model (llama-3.1-8b-instant) with Gemini 2.5 Flash fallback.
 * @param {string} text
 * @param {string} targetLang
 * @param {string} [sourceLang]
 */
export async function translateText(text, targetLang, sourceLang) {
  const target = mapLang(targetLang);
  const source = sourceLang ? mapLang(sourceLang) : null;
  const targetName = LANG_NAMES[target] || target;
  const sourceHint = source
    ? `from ${LANG_NAMES[source] || source}`
    : 'from the source language of the message';

  const translated = await llmChat({
    model: env.GROQ_LIGHT_MODEL,
    messages: [
      {
        role: 'system',
        content:
          `You translate consultation chat messages ${sourceHint} into ${targetName}. `
          + 'Preserve meaning and tone. Output only the translation with no quotes, labels, or commentary.',
      },
      { role: 'user', content: text },
    ],
    maxTokens: 1024,
    temperature: 0.1,
  });

  return translated.trim() || text;
}

