/**
 * Unified LLM client: Groq primary, Gemini fallback, OpenAI tertiary.
 */
import { env } from '../config/env.js';
import { groqChat } from './groqClient.js';
import { geminiChat } from './geminiClient.js';
import { openaiChat } from './openaiClient.js';

/**
 * @returns {Promise<string>}
 */
export async function llmChat(options) {
  const { text } = await llmChatWithMeta(options);
  return text;
}

/**
 * @returns {Promise<{ text: string, provider: 'groq' | 'gemini' | 'openai' }>}
 */
export async function llmChatWithMeta(options) {
  let groqError = null;

  if (process.env.FORCE_GROQ_FAILURE === 'true') {
    groqError = new Error('Groq failure forced via FORCE_GROQ_FAILURE=true');
    console.warn('[llm] Groq forced failure; attempting Gemini fallback');
  } else if (env.GROQ_API_KEY) {
    try {
      const text = await groqChat(options);
      return { text, provider: 'groq' };
    } catch (e) {
      groqError = e;
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[llm] Groq failed; attempting Gemini fallback:', msg);
    }
  } else {
    groqError = new Error('GROQ_API_KEY is not configured.');
  }

  // Fallback 1: Google Gemini
  let geminiError = null;
  if (env.GEMINI_API_KEY) {
    try {
      console.warn(`[llm] Using Gemini fallback (${env.GEMINI_MODEL || 'gemini-1.5-flash'})`);
      const text = await geminiChat(options);
      return { text, provider: 'gemini' };
    } catch (e) {
      geminiError = e;
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[llm] Gemini failed:', msg);
    }
  } else {
    geminiError = new Error('GEMINI_API_KEY is not configured.');
  }

  // Fallback 2: OpenAI (if configured)
  if (env.OPENAI_API_KEY) {
    try {
      console.warn(`[llm] Using OpenAI fallback (${env.OPENAI_CHAT_MODEL || 'gpt-4o-mini'})`);
      const text = await openaiChat(options);
      return { text, provider: 'openai' };
    } catch (openaiError) {
      const openaiMsg = openaiError instanceof Error ? openaiError.message : String(openaiError);
      throw new Error(`AI failed — Groq: ${groqError.message}; Gemini: ${geminiError.message}; OpenAI: ${openaiMsg}`);
    }
  }

  throw new Error(
    `AI unavailable — Groq: ${groqError.message}; Gemini: ${geminiError.message}.`,
  );
}
