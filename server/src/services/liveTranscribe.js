// ============================================================
// Ordinex - Live speech-to-text for consultation transcripts.
//
// Engine: Gemini audio transcription only (EN / Tagalog / Cebuano).
// Isolated from case-analysis quotas.
// ============================================================
import { transcribeAudioWithGemini } from './geminiClient.js';
import { env } from '../config/env.js';

/** Languages the live transcript supports. Anything else is clamped to English. */
const SUPPORTED_LANGS = new Set(['en', 'tl', 'ceb']);

/**
 * Normalize a language tag down to en | tl | ceb.
 */
export function clampTranscriptLang(raw, hint) {
  const val = String(raw || '').toLowerCase().trim();
  if (val.startsWith('ceb')) return 'ceb';
  if (val.startsWith('tl') || val.startsWith('fil') || val.includes('tagalog') || val.includes('filipino')) return 'tl';
  if (val.startsWith('en') || val.includes('english')) return 'en';
  const h = String(hint || '').toLowerCase().slice(0, 3);
  if (SUPPORTED_LANGS.has(h)) return h;
  if (h.startsWith('ceb')) return 'ceb';
  if (h.startsWith('tl') || h.startsWith('fil')) return 'tl';
  return 'en';
}

function hasGemini() {
  return env.GEMINI_API_KEYS.length > 0 || Boolean(env.GEMINI_API_KEY);
}

/** Reject silence / non-speech. Anything without a real letter or digit is dropped (including "."). */
export function isUselessTranscriptText(text) {
  const t = String(text || '')
    .replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, '')
    .trim();
  if (!t) return true;
  // No letter or number anywhere → punctuation/noise only (e.g. ".", "...", "—")
  if (!/\p{L}|\p{N}/u.test(t)) return true;
  // Common model placeholders for quiet audio
  if (/^(silence|\[silence\]|\(silence\)|no[- ]?speech|inaudible|blank|n\/?a|\.+|…+)$/i.test(t)) {
    return true;
  }
  return false;
}

/**
 * Transcribe a short audio clip captured during a live session (Gemini only).
 *
 * @param {{ audioBuffer: Buffer, mimeType?: string, filename?: string, langHint?: string }} opts
 * @returns {Promise<{ text: string, lang: string, provider: string }>}
 */
export async function transcribeLiveAudio({ audioBuffer, mimeType = 'audio/webm', filename = 'chunk.webm', langHint }) {
  if (!audioBuffer?.length) {
    return { text: '', lang: clampTranscriptLang(null, langHint), provider: 'noop' };
  }

  if (!hasGemini()) {
    console.warn('[liveTranscribe] GEMINI_API_KEY missing; live transcript disabled.');
    return { text: '', lang: clampTranscriptLang(null, langHint), provider: 'noop' };
  }

  try {
    const text = await transcribeAudioWithGemini({
      audioBuffer,
      mimeType,
      langHint: clampTranscriptLang(null, langHint),
    });
    if (!text || isUselessTranscriptText(text)) {
      return { text: '', lang: clampTranscriptLang(null, langHint), provider: 'gemini-audio' };
    }
    return {
      text: String(text).trim(),
      lang: clampTranscriptLang(null, langHint),
      provider: 'gemini-audio',
    };
  } catch (e) {
    console.warn('[liveTranscribe] Gemini transcription failed:', e.message);
    return { text: '', lang: clampTranscriptLang(null, langHint), provider: 'noop' };
  }
}
