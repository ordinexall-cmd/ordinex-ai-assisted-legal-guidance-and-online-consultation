/**
 * Booking chat translation — Ollama (local, free) primary, Groq/OpenAI fallback.
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

const OLLAMA_BASE = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

/** Check whether any translation backend is reachable. */
export function isTranslateAvailable() {
  // Translation is available if Ollama is running OR cloud keys are set
  return true;
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
 * Attempt translation via local Ollama instance (free, offline, unlimited).
 * Returns null if Ollama is unreachable so callers can fall back.
 */
async function ollamaTranslate(text, targetName, sourceHint) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);

    const response = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        messages: [
          {
            role: 'system',
            content:
              `You translate consultation chat messages ${sourceHint} into ${targetName}. `
              + 'Preserve meaning and tone. Output only the translation with no quotes, labels, or commentary.',
          },
          { role: 'user', content: text },
        ],
        options: { temperature: 0.1 },
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json();
    const result = data?.message?.content?.trim();
    return result || null;
  } catch {
    // Ollama not running or timed out — fall back to cloud
    return null;
  }
}

/**
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

  // 1. Try local Ollama first (free, private, unlimited)
  const ollamaResult = await ollamaTranslate(text, targetName, sourceHint);
  if (ollamaResult) {
    console.log('[translate] used Ollama (local)');
    return ollamaResult;
  }

  // 2. Fall back to cloud (Groq → OpenAI)
  if (!env.GROQ_API_KEY && !env.OPENAI_API_KEY) {
    const err = new Error('Translation unavailable: Ollama is offline and no cloud API keys are configured.');
    err.code = 'TRANSLATE_NOT_CONFIGURED';
    throw err;
  }

  console.log('[translate] Ollama offline, falling back to cloud');
  const translated = await llmChat({
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
