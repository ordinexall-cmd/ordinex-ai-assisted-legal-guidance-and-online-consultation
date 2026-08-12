/**
 * OpenAI chat completions — fallback when Groq is unavailable.
 */
import { env } from '../config/env.js';

export async function openaiChat({ messages, jsonMode = false, maxTokens = 4096, temperature = 0.25 }) {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }

  const body = {
    model: env.OPENAI_CHAT_MODEL,
    messages,
    temperature,
    max_tokens: maxTokens,
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || `OpenAI API error ${res.status}`);
  }

  return data.choices?.[0]?.message?.content?.trim() || '';
}
