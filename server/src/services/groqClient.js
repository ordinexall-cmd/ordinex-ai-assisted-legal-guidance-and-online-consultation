/**
 * Groq Chat Completions API client.
 * Used for AI case identification (identify + follow-up).
 */
import { env } from '../config/env.js';

let keyIndex = 0;
let groq429Hits = 0;

/** Lower the free daily cap when Groq RPD pressure is high. */
export function getAdaptiveDailyLimit(base = 5) {
  return groq429Hits >= 8 ? Math.min(base, 3) : base;
}

export async function groqChat({ messages, jsonMode = false, maxTokens = 4096, temperature = 0.25, model = null }) {
  const keys = env.GROQ_API_KEYS.length > 0 ? env.GROQ_API_KEYS : [env.GROQ_API_KEY].filter(Boolean);
  if (keys.length === 0) {
    throw new Error('GROQ_API_KEY is not configured.');
  }

  const selectedModel = model || env.GROQ_MODEL;
  const body = {
    model: selectedModel,
    messages,
    temperature,
    max_tokens: maxTokens,
  };
  if (jsonMode) body.response_format = { type: 'json_object' };
  // GPT-OSS is a reasoning model; hide reasoning so JSON mode returns JSON only.
  if (String(selectedModel).includes('gpt-oss')) {
    body.include_reasoning = false;
  }

  let lastError = null;
  // Try available keys in rotation if 429 or network errors occur
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const currentKey = keys[(keyIndex + attempt) % keys.length];
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${currentKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        const msg = data.error?.message || `Groq API error ${res.status}`;
        lastError = new Error(msg);
        // If rate limited (429) or unauthorized (401), try next key in pool
        if (res.status === 429 || res.status === 401) {
          if (res.status === 429) groq429Hits += 1;
          console.warn(`[groqClient] Key limit/error (${res.status}) on key attempt ${attempt + 1}, rotating key...`);
          continue;
        }
        throw lastError;
      }

      // Increment index for next call (round-robin)
      keyIndex = (keyIndex + attempt + 1) % keys.length;
      return data.choices?.[0]?.message?.content?.trim() || '';
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw lastError || new Error('All Groq API keys failed.');
}

/**
 * Multimodal vision via Groq chat completions (image_url data URLs).
 * Used for KYC (ID OCR + selfie/ID face compare). Isolated from the analysis
 * quota: 429s here do NOT increment groq429Hits, so a KYC spike cannot shrink
 * the daily case-identification cap.
 *
 * @param {{ prompt: string, images: Array<{ buffer: Buffer, mimeType?: string }>, jsonMode?: boolean, maxTokens?: number, temperature?: number }} opts
 * @returns {Promise<string>}
 */
export async function analyzeImageWithGroq({ prompt, images = [], jsonMode = false, maxTokens = 1024, temperature = 0.1 }) {
  const keys = env.GROQ_API_KEYS.length > 0 ? env.GROQ_API_KEYS : [env.GROQ_API_KEY].filter(Boolean);
  if (keys.length === 0) {
    throw new Error('GROQ_API_KEY is not configured for vision.');
  }
  if (!images.length) {
    throw new Error('analyzeImageWithGroq requires at least one image.');
  }

  const content = [{ type: 'text', text: prompt }];
  for (const img of images) {
    if (!img?.buffer) continue;
    const b64 = img.buffer.toString('base64');
    content.push({
      type: 'image_url',
      image_url: { url: `data:${img.mimeType || 'image/jpeg'};base64,${b64}` },
    });
  }

  const body = {
    model: env.GROQ_VISION_MODEL,
    messages: [{ role: 'user', content }],
    temperature,
    max_tokens: maxTokens,
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  let lastError = null;
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const currentKey = keys[(keyIndex + attempt) % keys.length];
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${currentKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        lastError = new Error(data.error?.message || `Groq Vision error ${res.status}`);
        // Rotate on rate/auth errors, but do NOT touch groq429Hits (isolate from analysis cap).
        if (res.status === 429 || res.status === 401) {
          console.warn(`[groqClient] Vision key limit/error (${res.status}), rotating key...`);
          continue;
        }
        throw lastError;
      }
      keyIndex = (keyIndex + attempt + 1) % keys.length;
      return data.choices?.[0]?.message?.content?.trim() || '';
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError || new Error('All Groq API keys failed (vision).');
}

