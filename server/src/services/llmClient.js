import { env } from '../config/env.js';
import { groqChat, getAdaptiveDailyLimit } from './groqClient.js';
import { geminiChat } from './geminiClient.js';

// Simple in-memory response cache & daily usage tracking
const responseCache = new Map();
const userDailyUsage = new Map();
const visitorsToday = new Set();
let lastResetDay = new Date().getUTCDate();

// Traffic-aware analysis quota: more free analyses on low-traffic days.
const LOW_TRAFFIC_LIMIT = 12;
const HIGH_TRAFFIC_LIMIT = 5;
const TRAFFIC_THRESHOLD = 1000; // unique visitors per UTC day

function resetUsageIfNewDay() {
  const currentDay = new Date().getUTCDate();
  if (currentDay !== lastResetDay) {
    userDailyUsage.clear();
    visitorsToday.clear();
    lastResetDay = currentDay;
  }
}

/** Record a unique visitor (by IP) for today's traffic-aware quota. */
export function recordVisitor(ip) {
  resetUsageIfNewDay();
  if (ip) visitorsToday.add(String(ip));
}

/** Unique visitors seen so far today (resets at UTC midnight). */
export function getUniqueVisitorCount() {
  resetUsageIfNewDay();
  return visitorsToday.size;
}

/** Base daily analysis cap: 12 on low-traffic days, 5 once we pass the threshold. */
function getTrafficAwareBase() {
  return getUniqueVisitorCount() < TRAFFIC_THRESHOLD ? LOW_TRAFFIC_LIMIT : HIGH_TRAFFIC_LIMIT;
}

/**
 * Checks & increments user/IP daily usage with friendly quota messaging.
 * Base is traffic-aware (12 low / 5 high); Groq chat 429 pressure can lower it to 3.
 * @param {string} userIdentifier - User ID or IP address
 * @param {number} [baseLimitOverride] - Optional explicit base (else traffic-aware)
 * @returns {{ allowed: boolean, remaining: number, warning: boolean, message?: string }}
 */
export function checkUserDailyQuota(userIdentifier, baseLimitOverride) {
  resetUsageIfNewDay();
  const id = userIdentifier || 'anonymous';
  const base = typeof baseLimitOverride === 'number' ? baseLimitOverride : getTrafficAwareBase();
  const limit = getAdaptiveDailyLimit(base);
  const currentCount = userDailyUsage.get(id) || 0;

  if (currentCount >= limit) {
    return {
      allowed: false,
      remaining: 0,
      warning: false,
      message: "You have reached today's limit. Please return tomorrow at 8:00 AM PHT when daily limits reset!",
    };
  }

  const newCount = currentCount + 1;
  userDailyUsage.set(id, newCount);
  const remaining = limit - newCount;
  const warning = remaining === 1;

  return {
    allowed: true,
    remaining,
    warning,
    message: warning ? 'Your daily usage is about to run out.' : undefined,
  };
}

/**
 * @returns {Promise<string>}
 */
export async function llmChat(options) {
  const { text } = await llmChatWithMeta(options);
  return text;
}

/**
 * @returns {Promise<{ text: string, provider: 'groq' | 'gemini' }>}
 */
export async function llmChatWithMeta(options) {
  // Check cache if cacheKey provided
  if (options.cacheKey && responseCache.has(options.cacheKey)) {
    return { text: responseCache.get(options.cacheKey), provider: 'groq' };
  }

  let groqError = null;

  const hasGroqKeys = env.GROQ_API_KEYS.length > 0 || Boolean(env.GROQ_API_KEY);
  if (process.env.FORCE_GROQ_FAILURE === 'true') {
    groqError = new Error('Groq failure forced via FORCE_GROQ_FAILURE=true');
    console.warn('[llm] Groq forced failure; attempting Gemini fallback');
  } else if (hasGroqKeys) {
    try {
      const text = await groqChat(options);
      if (options.cacheKey) responseCache.set(options.cacheKey, text);
      return { text, provider: 'groq' };
    } catch (e) {
      groqError = e;
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[llm] Groq failed; attempting Gemini fallback:', msg);
    }
  } else {
    groqError = new Error('GROQ_API_KEY is not configured.');
  }

  // Fallback 1: Google Gemini (Multimodal / Flash)
  let geminiError = null;
  const hasGeminiKeys = env.GEMINI_API_KEYS.length > 0 || Boolean(env.GEMINI_API_KEY);
  if (hasGeminiKeys) {
    try {
      console.warn(`[llm] Using Gemini fallback (${env.GEMINI_MODEL || 'gemini-2.5-flash'})`);
      const text = await geminiChat(options);
      if (options.cacheKey) responseCache.set(options.cacheKey, text);
      return { text, provider: 'gemini' };
    } catch (e) {
      geminiError = e;
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[llm] Gemini failed:', msg);
    }
  } else {
    geminiError = new Error('GEMINI_API_KEY is not configured.');
  }

  throw new Error(
    `AI unavailable — Groq: ${groqError.message}; Gemini: ${geminiError.message}.`,
  );
}

