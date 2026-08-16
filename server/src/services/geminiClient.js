/**
 * Google Gemini API client — fallback when Groq is unavailable.
 * Uses Gemini 1.5 Flash via REST API.
 */
import { env } from '../config/env.js';

let keyIndex = 0;

export async function geminiChat({ messages, jsonMode = false, maxTokens = 4096, temperature = 0.25 }) {
  const keys = env.GEMINI_API_KEYS.length > 0 ? env.GEMINI_API_KEYS : [env.GEMINI_API_KEY].filter(Boolean);
  if (keys.length === 0) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  // Convert OpenAI-style messages array to Gemini format
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
 * Multimodal vision helper: Analyze image buffer (e.g. Government ID or Selfie challenge code)
 */
export async function analyzeImageWithGemini({ prompt, imageBuffer, mimeType = 'image/jpeg' }) {
  const keys = env.GEMINI_API_KEYS.length > 0 ? env.GEMINI_API_KEYS : [env.GEMINI_API_KEY].filter(Boolean);
  if (keys.length === 0) {
    throw new Error('GEMINI_API_KEY is not configured for image analysis.');
  }

  const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
  const base64Data = imageBuffer.toString('base64');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keys[0]}`;

  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error?.message || `Gemini Vision error ${res.status}`);
  }

  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

