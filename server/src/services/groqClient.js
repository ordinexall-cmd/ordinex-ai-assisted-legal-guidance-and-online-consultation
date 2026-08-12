/**
 * Groq OpenAI-compatible API client.
 * Used for AI case analysis (analyze + follow-up).
 */
import { env } from '../config/env.js';

export async function groqChat({ messages, jsonMode = false, maxTokens = 4096, temperature = 0.25 }) {
  if (!env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured.');
  }

  const body = {
    model: env.GROQ_MODEL,
    messages,
    temperature,
    max_tokens: maxTokens,
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || `Groq API error ${res.status}`);
  }

  return data.choices?.[0]?.message?.content?.trim() || '';
}
