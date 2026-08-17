// ============================================================
// Ordinex - Live speech-to-text for consultation transcripts.
//
// Primary engine: Groq Whisper (whisper-large-v3-turbo) — hears the
// spoken audio and writes it back as TEXT in the SAME language.
// Fallback: Gemini 3.6 Flash audio transcription when Whisper fails.
//
// This path is deliberately ISOLATED from the case-analysis quota:
// neither Whisper nor Gemini transcription touches the Llama chat
// 429 counter, so a talkative session never shrinks a user's daily
// analysis credits.
// ============================================================
import { transcribeAudioWithGroq } from './groqClient.js';
import { transcribeAudioWithGemini } from './geminiClient.js';
import { env } from '../config/env.js';

/** Languages the live transcript supports. Anything else is clamped to English. */
const SUPPORTED_LANGS = new Set(['en', 'tl', 'ceb']);

/**
 * Normalize a Whisper/Gemini/browser language tag down to en | tl | ceb.
 * Whisper returns ISO-639-1 ("en", "tl") or full names ("english",
 * "tagalog", "cebuano"); Cebuano is often mislabeled as Tagalog/Filipino.
 */
export function clampTranscriptLang(raw, hint) {
  const val = String(raw || '').toLowerCase().trim();
  if (val.startsWith('ceb')) return 'ceb';
  if (val.startsWith('tl') || val.startsWith('fil') || val.includes('tagalog') || val.includes('filipino')) return 'tl';
  if (val.startsWith('en') || val.includes('english')) return 'en';
  // Fall back to the caller's hint (the participant's chosen language) if valid.
  const h = String(hint || '').toLowerCase().slice(0, 3);
  if (SUPPORTED_LANGS.has(h)) return h;
  if (h.startsWith('ceb')) return 'ceb';
  if (h.startsWith('tl') || h.startsWith('fil')) return 'tl';
  return 'en';
}

function hasGroq() {
  return env.GROQ_API_KEYS.length > 0 || Boolean(env.GROQ_API_KEY);
}

function hasGemini() {
  return env.GEMINI_API_KEYS.length > 0 || Boolean(env.GEMINI_API_KEY);
}

/**
 * Transcribe a short audio clip captured during a live session.
 *
 * @param {{ audioBuffer: Buffer, mimeType?: string, filename?: string, langHint?: string }} opts
 * @returns {Promise<{ text: string, lang: string, provider: string }>}
 */
export async function transcribeLiveAudio({ audioBuffer, mimeType = 'audio/webm', filename = 'chunk.webm', langHint }) {
  if (!audioBuffer?.length) {
    return { text: '', lang: clampTranscriptLang(null, langHint), provider: 'noop' };
  }

  // 1. Primary: Groq Whisper (same-language speech → text)
  if (hasGroq()) {
    try {
      const hint = ['en', 'tl'].includes(String(langHint || '').slice(0, 2)) ? langHint.slice(0, 2) : undefined;
      const { text, language } = await transcribeAudioWithGroq({ audioBuffer, mimeType, filename, language: hint });
      if (text) {
        return { text, lang: clampTranscriptLang(language, langHint), provider: 'groq-whisper' };
      }
    } catch (e) {
      console.warn('[liveTranscribe] Groq Whisper failed, trying Gemini fallback:', e.message);
    }
  }

  // 2. Fallback: Gemini audio transcription
  if (hasGemini()) {
    try {
      const text = await transcribeAudioWithGemini({ audioBuffer, mimeType });
      if (text) {
        return { text, lang: clampTranscriptLang(null, langHint), provider: 'gemini-audio' };
      }
    } catch (e) {
      console.warn('[liveTranscribe] Gemini transcription failed:', e.message);
    }
  }

  return { text: '', lang: clampTranscriptLang(null, langHint), provider: 'noop' };
}
