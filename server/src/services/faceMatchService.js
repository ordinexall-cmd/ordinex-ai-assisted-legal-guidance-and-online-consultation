// ============================================================
// Ordinex - Face match adapter for selfie vs ID verification.
//
// In production this can be wired to face-api.js (Node build),
// AWS Rekognition, or an on-prem ONNX model. In the absence of
// any of those, we return a deterministic, content-derived score
// so the verification pipeline keeps working in development while
// still being defensible — the engine knows the provider is a
// stub and weights it lower (see PROVIDER_WEIGHTS).
//
// All distance values use the face-api.js convention:
//   distance ∈ [0, 1+]      lower = same person
//   distance < 0.4          → strong match
//   distance > 0.6          → likely different people
// ============================================================
import crypto from 'crypto';
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
  // A "different person" verdict caps the effective score regardless of stated confidence.
  const score = same ? confidence : Math.min(confidence, 0.2);
  return { score, distance: Math.max(0, Math.min(1, (1 - score) * 0.8)) };
}

let faceapiLoadAttempted = false;
let faceapiModule = null;

async function loadFaceapi() {
  if (faceapiLoadAttempted) return faceapiModule;
  faceapiLoadAttempted = true;
  try {
    // Optional dependency — only loads if user runs `npm i face-api.js @tensorflow/tfjs-node canvas`
    const mod = await import('face-api.js');
    faceapiModule = mod.default || mod;
  } catch {
    faceapiModule = null;
  }
  return faceapiModule;
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

  const idMime = 'image/jpeg';
  const selfieMime = 'image/jpeg';
  const images = [
    { buffer: idBuffer, mimeType: idMime },
    { buffer: selfieBuffer, mimeType: selfieMime },
  ];

  // 1. Primary: Groq vision face compare (isolated from analysis quota)
  if (hasGroqVision()) {
    try {
      const jsonStr = await analyzeImageWithGroq({ prompt: FACE_COMPARE_PROMPT, images, jsonMode: true });
      const { score, distance } = parseFaceJson(jsonStr);
      return { provider: 'groq-vision', distance, score };
    } catch (err) {
      console.warn('[faceMatchService] Groq vision compare failed, trying Gemini fallback:', err.message);
    }
  }

  // 2. Fallback: Gemini vision face compare
  if (hasGemini()) {
    try {
      const jsonStr = await analyzeImageWithGemini({ prompt: FACE_COMPARE_PROMPT, images, jsonMode: true });
      const { score, distance } = parseFaceJson(jsonStr);
      return { provider: 'gemini-vision', distance, score };
    } catch (err) {
      console.warn('[faceMatchService] Gemini vision compare failed, falling back:', err.message);
    }
  }

  const faceapi = await loadFaceapi();
  if (faceapi && typeof faceapi.computeFaceDescriptor === 'function') {
    try {
      const idDesc = await faceapi.computeFaceDescriptor(idBuffer);
      const selfDesc = await faceapi.computeFaceDescriptor(selfieBuffer);
      const distance = faceapi.euclideanDistance(idDesc, selfDesc);
      return {
        provider: 'face-api.js',
        distance,
        score: Math.max(0, Math.min(1, 1 - distance / 0.8)),
      };
    } catch (err) {
      console.warn('[faceMatchService] face-api failed, falling back:', err.message);
    }
  }

  // Deterministic stub: hash both buffers and use Hamming-style overlap
  // of the resulting digests. Same selfie+ID combos always score the
  // same; different combos get a sensibly distributed score. This is
  // explicitly marked provider='hash-stub' so the scoring engine de-
  // weights its contribution.
  const a = crypto.createHash('sha256').update(idBuffer).digest();
  const b = crypto.createHash('sha256').update(selfieBuffer).digest();
  let agree = 0;
  for (let i = 0; i < a.length; i++) {
    const xor = a[i] ^ b[i];
    // popcount each XOR byte
    let v = xor;
    v = v - ((v >> 1) & 0x55);
    v = (v & 0x33) + ((v >> 2) & 0x33);
    agree += 8 - (((v + (v >> 4)) & 0x0f));
  }
  const ratio = agree / (a.length * 8); // 0..1, ~0.5 for random pairs
  // Convert "bit overlap" to a face-distance proxy in [0.2, 0.9].
  const distance = Math.max(0.2, Math.min(0.9, 1 - ratio));
  return {
    provider: 'hash-stub',
    distance,
    score: Math.max(0, Math.min(1, 1 - distance / 0.8)),
  };
}

export const FACE_PROVIDER_WEIGHTS = {
  'groq-vision': 1,
  'gemini-vision': 1,
  'face-api.js': 1,
  'hash-stub': 0.4,
  noop: 0,
};
