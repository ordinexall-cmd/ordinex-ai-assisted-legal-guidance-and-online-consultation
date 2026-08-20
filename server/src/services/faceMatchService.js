// ============================================================
// Ordinex - Face match adapter for selfie vs ID verification.
//
// Groq vision first, then Gemini vision. Returns noop when no
// AI provider is configured or both fail.
// ============================================================
import { analyzeImageWithGroq } from './groqClient.js';
import { analyzeImageWithGemini } from './geminiClient.js';
import { env } from '../config/env.js';

const FACE_COMPARE_PROMPT =
  'You are a strict identity-verification system. Two images are provided: the first is a photo cropped from a government ID, ' +
  'the second is a live selfie. Decide whether they show the SAME person. ' +
  'Return ONLY a JSON object: {"same": boolean, "confidence": number between 0 and 1}. ' +
  'Base confidence on facial structure similarity, not clothing or background.';

function hasGroqVision() {
  return env.GROQ_API_KEYS.length > 0 || Boolean(env.GROQ_API_KEY);
}

function hasGemini() {
  return env.GEMINI_API_KEYS.length > 0 || Boolean(env.GEMINI_API_KEY);
}

function parseFaceJson(jsonStr) {
  const cleaned = jsonStr.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
  const parsed = JSON.parse(cleaned);
  const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
  const same = Boolean(parsed.same);
  const score = same ? confidence : Math.min(confidence, 0.2);
  return { score, distance: Math.max(0, Math.min(1, (1 - score) * 0.8)) };
}

/**
 * Produce a 0..1 face-match score where 1 is "identical person".
 *
 * @param {{ idBuffer: Buffer, selfieBuffer: Buffer }} input
 * @returns {Promise<{ provider: string, distance: number, score: number }>}
 */
export async function compareFaces({ idBuffer, selfieBuffer }) {
  if (!idBuffer || !selfieBuffer) {
    return { provider: 'noop', distance: 1, score: 0 };
  }

  const images = [
    { buffer: idBuffer, mimeType: 'image/jpeg' },
    { buffer: selfieBuffer, mimeType: 'image/jpeg' },
  ];

  if (hasGroqVision()) {
    try {
      const jsonStr = await analyzeImageWithGroq({ prompt: FACE_COMPARE_PROMPT, images, jsonMode: true });
      const { score, distance } = parseFaceJson(jsonStr);
      return { provider: 'groq-vision', distance, score };
    } catch (err) {
      console.warn('[faceMatchService] Groq vision compare failed, trying Gemini fallback:', err.message);
    }
  }

  if (hasGemini()) {
    try {
      const jsonStr = await analyzeImageWithGemini({ prompt: FACE_COMPARE_PROMPT, images, jsonMode: true });
      const { score, distance } = parseFaceJson(jsonStr);
      return { provider: 'gemini-vision', distance, score };
    } catch (err) {
      console.warn('[faceMatchService] Gemini vision compare failed:', err.message);
    }
  }

  return { provider: 'noop', distance: 1, score: 0 };
}

export const FACE_PROVIDER_WEIGHTS = {
  'groq-vision': 1,
  'gemini-vision': 1,
  noop: 0,
};
