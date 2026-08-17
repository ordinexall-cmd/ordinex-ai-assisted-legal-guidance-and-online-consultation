/**
 * Google Gemini API client — single fallback when Groq is unavailable.
 * Handles chat, vision (KYC), and speech-to-text via the REST API.
 * Model is env.GEMINI_MODEL (default gemini-3.6-flash).
 */
import { env } from '../config/env.js';

let keyIndex = 0;

export async function geminiChat({ messages, jsonMode = false, maxTokens = 4096, temperature = 0.25 }) {
  const keys = env.GEMINI_API_KEYS.length > 0 ? env.GEMINI_API_KEYS : [env.GEMINI_API_KEY].filter(Boolean);
  if (keys.length === 0) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  // Convert chat messages array to Gemini format
  let systemInstruction = '';
  const contents = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemInstruction += (systemInstruction ? '\n\n' : '') + msg.content;
    } else {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }
  }

  const model = env.GEMINI_MODEL || 'gemini-flash-latest';
  let lastError = null;

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const currentKey = keys[(keyIndex + attempt) % keys.length];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${currentKey}`;

    const body = {
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    if (jsonMode) {
      body.generationConfig.responseMimeType = 'application/json';
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = data.error?.message || `Gemini API error ${res.status}`;
        lastError = new Error(errMsg);
        if (res.status === 429 || res.status === 401) {
          console.warn(`[geminiClient] Gemini key error (${res.status}), rotating key...`);
          continue;
        }
        throw lastError;
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('Gemini API returned an empty response.');
      }

      keyIndex = (keyIndex + attempt + 1) % keys.length;
      return text.trim();
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw lastError || new Error('All Gemini API keys failed.');
}

/**
 * Multimodal helper: send a prompt plus one or more media parts (images or audio)
 * to Gemini and return the text response. Rotates keys on 429/401.
 *
 * @param {{ prompt: string, media: Array<{ buffer: Buffer, mimeType: string }>, jsonMode?: boolean }} opts
 * @returns {Promise<string>}
 */
async function generateFromMedia({ prompt, media = [], jsonMode = false }) {
  const keys = env.GEMINI_API_KEYS.length > 0 ? env.GEMINI_API_KEYS : [env.GEMINI_API_KEY].filter(Boolean);
  if (keys.length === 0) {
    throw new Error('GEMINI_API_KEY is not configured for multimodal analysis.');
  }

  const model = env.GEMINI_MODEL || 'gemini-3.6-flash';
  const parts = [{ text: prompt }];
  for (const m of media) {
    if (!m?.buffer) continue;
    parts.push({ inlineData: { mimeType: m.mimeType || 'image/jpeg', data: m.buffer.toString('base64') } });
  }

  const body = { contents: [{ parts }] };
  if (jsonMode) body.generationConfig = { responseMimeType: 'application/json' };

  let lastError = null;
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const currentKey = keys[(keyIndex + attempt) % keys.length];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${currentKey}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        lastError = new Error(data.error?.message || `Gemini multimodal error ${res.status}`);
        if (res.status === 429 || res.status === 401) {
          console.warn(`[geminiClient] Multimodal key error (${res.status}), rotating key...`);
          continue;
        }
        throw lastError;
      }
      keyIndex = (keyIndex + attempt + 1) % keys.length;
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError || new Error('All Gemini API keys failed (multimodal).');
}

/**
 * Vision helper: analyze one or more image buffers (e.g. Government ID + selfie).
 * Backward-compatible with the single-image `imageBuffer` signature.
 */
export async function analyzeImageWithGemini({ prompt, imageBuffer, images, mimeType = 'image/jpeg', jsonMode = false }) {
  const media = Array.isArray(images) && images.length
    ? images.map((img) => ({ buffer: img.buffer, mimeType: img.mimeType || 'image/jpeg' }))
    : [{ buffer: imageBuffer, mimeType }];
  return generateFromMedia({ prompt, media, jsonMode });
}

/**
 * Speech-to-text fallback: transcribe an audio clip with Gemini, keeping the
 * spoken language. Returns plain transcript text.
 */
export async function transcribeAudioWithGemini({ audioBuffer, mimeType = 'audio/webm' }) {
  const prompt =
    'Transcribe this audio exactly as spoken. Keep the original language (English, Tagalog, or Cebuano). ' +
    'Return ONLY the transcript text with no labels, quotes, or commentary.';
  return generateFromMedia({ prompt, media: [{ buffer: audioBuffer, mimeType }] });
}

