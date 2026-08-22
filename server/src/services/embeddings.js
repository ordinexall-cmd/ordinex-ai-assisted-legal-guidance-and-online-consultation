/**
 * Multilingual embeddings (Gemini) + chunk helpers for hybrid RAG.
 * Embeddings stored as JSON arrays in LawEmbeddingChunk.embeddingJson.
 */
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';

const EMBED_MODELS = [
  process.env.GEMINI_EMBED_MODEL,
  'text-embedding-004',
  'embedding-001',
].filter(Boolean);
const CHUNK_SIZE = 700;
const CHUNK_OVERLAP = 120;

function getGeminiKeys() {
  return env.GEMINI_API_KEYS.length > 0 ? env.GEMINI_API_KEYS : [env.GEMINI_API_KEY].filter(Boolean);
}

/**
 * @param {string} text
 * @returns {Promise<number[]|null>}
 */
export async function embedText(text) {
  const keys = getGeminiKeys();
  if (!keys.length || !String(text || '').trim()) return null;

  let lastErr = null;

  for (const model of EMBED_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`;
    for (const key of keys) {
      try {
        const res = await fetch(`${url}?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: `models/${model}`,
            content: { parts: [{ text: String(text).slice(0, 8000) }] },
          }),
        });
        if (!res.ok) {
          lastErr = new Error(`Gemini embed ${model} ${res.status}`);
          continue;
        }
        const data = await res.json();
        const values = data?.embedding?.values;
        if (Array.isArray(values) && values.length) return values;
      } catch (e) {
        lastErr = e;
      }
    }
  }

  if (lastErr) console.warn('[embeddings] embed failed:', lastErr.message);
  return null;
}

export function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const src = String(text || '').trim();
  if (!src) return [];
  if (src.length <= chunkSize) return [src];

  const chunks = [];
  let start = 0;
  while (start < src.length) {
    const end = Math.min(start + chunkSize, src.length);
    chunks.push(src.slice(start, end));
    if (end >= src.length) break;
    start = end - overlap;
  }
  return chunks;
}

function parseGuidance(raw) {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

/** Build embeddable text from a LawReference row. */
export function buildLawEmbedTexts(law) {
  const g = parseGuidance(law.guidanceJson);
  const header = [
    law.name,
    law.keywords,
    g.concernSummary || '',
    g.penaltiesSummary || '',
    (g.suggestedNextSteps || []).join('. '),
    (g.documentsNeeded || []).join('. '),
    (g.cautions || []).join('. '),
    g.recommendedAgency || '',
  ].filter(Boolean).join('\n');

  const bodyChunks = chunkText(law.fullText || '');
  if (!bodyChunks.length) return [header].filter(Boolean);
  return [header, ...bodyChunks].filter((t) => t.length > 20);
}

export function cosineSimilarity(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? dot / denom : 0;
}

/**
 * Vector search over LawEmbeddingChunk rows (in-memory cosine).
 * @returns {Promise<{ lawReferenceId: string, score: number, chunkText: string }[]>}
 */
export async function vectorSearchLegalChunks(queryText, { limit = 12, category } = {}) {
  const queryVec = await embedText(queryText);
  if (!queryVec) return [];

  const where = category && category !== 'unsure' && category !== 'General'
    ? { lawReference: { category: { contains: category, mode: 'insensitive' } } }
    : {};

  let rows;
  try {
    rows = await prisma.lawEmbeddingChunk.findMany({
      where: {
        ...where,
        lawReference: { corpusStatus: { not: 'REPEALED' } },
      },
      include: {
        lawReference: {
          select: { id: true, corpusStatus: true, priority: true, region: true },
        },
      },
      take: 2000,
    });
  } catch (e) {
    console.warn('[embeddings] vectorSearch query failed:', e.message);
    return [];
  }

  if (!rows.length) return [];

  const scored = [];
  for (const row of rows) {
    let vec;
    try { vec = JSON.parse(row.embeddingJson); } catch { continue; }
    const sim = cosineSimilarity(queryVec, vec);
    if (sim < 0.25) continue;
    let score = sim * 10;
    if (row.lawReference?.priority === 'high') score += 0.5;
    if (row.lawReference?.corpusStatus === 'SUPERSEDED') score -= 1;
    scored.push({
      lawReferenceId: row.lawReferenceId,
      score,
      chunkText: row.chunkText,
      chunkIndex: row.chunkIndex,
    });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Re-embed all chunks for one LawReference.
 */
export async function embedLawReference(lawId) {
  const law = await prisma.lawReference.findUnique({ where: { id: lawId } });
  if (!law) return { ok: false, reason: 'not_found' };

  const texts = buildLawEmbedTexts(law);
  if (!texts.length) return { ok: false, reason: 'empty' };

  await prisma.lawEmbeddingChunk.deleteMany({ where: { lawReferenceId: lawId } });

  let created = 0;
  for (let i = 0; i < texts.length; i++) {
    const vec = await embedText(texts[i]);
    if (!vec) continue;
    await prisma.lawEmbeddingChunk.create({
      data: {
        lawReferenceId: lawId,
        chunkIndex: i,
        chunkText: texts[i].slice(0, 4000),
        embeddingJson: JSON.stringify(vec),
      },
    });
    created++;
  }

  return { ok: created > 0, chunks: created };
}

/** Embed all laws (backfill). */
export async function embedAllLawReferences({ batchPauseMs = 300 } = {}) {
  const laws = await prisma.lawReference.findMany({
    where: { corpusStatus: { not: 'REPEALED' } },
    select: { id: true, name: true },
  });
  let ok = 0;
  let fail = 0;
  for (const law of laws) {
    const r = await embedLawReference(law.id);
    if (r.ok) ok++;
    else fail++;
    if (batchPauseMs) await new Promise((r) => setTimeout(r, batchPauseMs));
  }
  return { total: laws.length, ok, fail };
}
