// ============================================================
// Ordinex — Text embeddings (optional, for vector RAG)
// Set OPENAI_API_KEY or use Groq-compatible endpoint via EMBEDDING_API_URL
// ============================================================
import { env } from '../config/env.js';

/**
 * @returns {Promise<number[]|null>}
 */
export async function embedQuery(text) {
  const apiKey = env.OPENAI_API_KEY || env.GROQ_API_KEY;
  const baseUrl = env.EMBEDDING_API_URL || (env.OPENAI_API_KEY
    ? 'https://api.openai.com/v1'
    : 'https://api.groq.com/openai/v1');
  const model = env.EMBEDDING_MODEL || 'text-embedding-3-small';

  if (!apiKey) return null;

  try {
    const res = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: text.slice(0, 8000),
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}
