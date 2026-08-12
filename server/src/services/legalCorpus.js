/**
 * Legal knowledge retrieval — Supabase first, Prisma LawReference fallback.
 */
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { tokenizeForMatch } from './textPreprocess.js';
import { embedQuery } from './embeddings.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let sb = null;
function getSupabase() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return null;
  if (!sb) sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  return sb;
}

function scoreChunk(chunk, tokens, category) {
  const hay = `${chunk.keywords} ${chunk.content} ${chunk.name} ${chunk.citation} ${chunk.category}`.toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (hay.includes(t)) score += 2;
  }
  if (category && category !== 'unsure' && chunk.category?.toLowerCase().includes(category.toLowerCase())) {
    score += 3;
  }
  if (chunk.region === 'Davao') score += 1;
  return score;
}

async function retrieveFromSupabaseVector({ description, limit = 8 }) {
  const client = getSupabase();
  if (!client) return null;

  const vector = await embedQuery(description);
  if (!vector) return null;

  const { data, error } = await client.rpc('match_legal_chunks', {
    query_embedding: vector,
    match_count: limit,
  });

  if (error) {
    if (error.code === 'PGRST202' || error.message?.includes('match_legal_chunks')) return null;
    throw error;
  }
  if (!data?.length) return null;

  return data.map((row) => ({
    id: row.id,
    content: row.content,
    keywords: row.keywords,
    region: row.region,
    name: row.name,
    citation: row.citation,
    category: row.category,
    source_url: row.source_url,
    // Freshness metadata (from migration 004). May be null on older schemas.
    status: row.status || 'ACTIVE',
    priority: row.priority || 'medium',
    last_changed_at: row.last_changed_at || null,
    superseded_by: row.superseded_by || null,
    score: row.similarity ?? 1,
  }));
}

async function retrieveFromSupabase({ category, description, limit = 8 }) {
  const client = getSupabase();
  if (!client) return null;

  try {
    const vectorHits = await retrieveFromSupabaseVector({ description, limit });
    if (vectorHits?.length) return vectorHits;
  } catch (e) {
    console.warn('[legalCorpus] vector retrieve failed:', e.message);
  }

  // Pull the freshness columns when available; gracefully degrade if not.
  const richSelect = `
    id,
    content,
    keywords,
    region,
    legal_sources (
      id,
      name,
      citation,
      category,
      region,
      source_url,
      status,
      priority,
      last_changed_at,
      superseded_by
    )
  `;
  const legacySelect = `
    id,
    content,
    keywords,
    region,
    legal_sources (
      id,
      name,
      citation,
      category,
      region,
      source_url
    )
  `;

  let { data, error } = await client.from('legal_chunks').select(richSelect).limit(100);
  if (error && /status|priority|last_changed_at|superseded_by/i.test(error.message || '')) {
    ({ data, error } = await client.from('legal_chunks').select(legacySelect).limit(100));
  }
  if (error) {
    if (error.code === 'PGRST205') return null;
    throw error;
  }
  if (!data?.length) return null;

  // Exclude rows whose source has been superseded or repealed (older schemas
  // won't have a status, so default to ACTIVE).
  const liveData = data.filter((row) => {
    const status = row.legal_sources?.status || 'ACTIVE';
    return status !== 'SUPERSEDED' && status !== 'REPEALED';
  });
  const pool = liveData.length ? liveData : data;

  const tokens = tokenizeForMatch(description);
  const toChunk = (row, score) => {
    const src = row.legal_sources;
    return {
      id: row.id,
      content: row.content,
      keywords: row.keywords,
      region: row.region,
      name: src?.name,
      citation: src?.citation,
      category: src?.category,
      source_url: src?.source_url,
      status: src?.status || 'ACTIVE',
      priority: src?.priority || 'medium',
      last_changed_at: src?.last_changed_at || null,
      superseded_by: src?.superseded_by || null,
      score,
    };
  };

  const scored = pool
    .map((row) => {
      const src = row.legal_sources;
      const score = scoreChunk({
        keywords: row.keywords,
        content: row.content,
        name: src?.name,
        citation: src?.citation,
        category: src?.category,
        region: row.region,
      }, tokens, category);
      // Soft boost for high-priority entries so curated concerns rise to the top.
      const priorityBoost = (src?.priority === 'high') ? 2 : 0;
      return toChunk(row, score + priorityBoost);
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  const top = (scored.length ? scored : pool.map((row) => toChunk(row, 1))).slice(0, limit);

  return top;
}

async function retrieveFromPrisma({ category, description, limit = 8 }) {
  const where = category && category !== 'unsure' ? { category: { contains: category } } : {};
  const rows = await prisma.lawReference.findMany({ where, take: 50 });
  const tokens = tokenizeForMatch(description);

  return rows
    .map((law) => ({
      id: law.id,
      content: law.fullText,
      keywords: law.keywords,
      region: 'National',
      name: law.name,
      citation: law.name,
      category: law.category,
      source_url: law.link,
      score: scoreChunk({
        keywords: law.keywords,
        content: law.fullText,
        name: law.name,
        citation: law.name,
        category: law.category,
        region: 'National',
      }, tokens, category),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

let localCorpusCache = null;
function loadLocalCorpus() {
  if (localCorpusCache) return localCorpusCache;
  const corpus = [];
  const basePath = path.join(__dirname, '../../prisma/phLaws.json');
  const extPath = path.join(__dirname, '../../prisma/phLawsExtended.json');
  const davaoPath = path.join(__dirname, '../../data/davaoLegalSeed.json');

  const tryRead = (p) => {
    if (!fs.existsSync(p)) return [];
    try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return []; }
  };

  const base = tryRead(basePath);
  const extended = tryRead(extPath);
  const davao = tryRead(davaoPath);

  const seen = new Set();
  for (const law of [...base, ...extended, ...davao]) {
    const key = (law.name || '').toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    corpus.push({
      ...law,
      region: law.region || 'National',
      citation: law.citation || law.name,
    });
  }
  localCorpusCache = corpus;
  return corpus;
}

/**
 * Public helper: report how many active, high-priority curated entries
 * are present locally. Used by health checks and the orchestrator to
 * detect under-seeded environments.
 */
export function getLocalCorpusStats() {
  const laws = loadLocalCorpus();
  const byCategory = {};
  let highPriority = 0;
  for (const law of laws) {
    byCategory[law.category] = (byCategory[law.category] || 0) + 1;
    if (law.priority === 'high') highPriority++;
  }
  return {
    total: laws.length,
    highPriority,
    byCategory,
    meetsMinimum: laws.length >= 200,
  };
}

async function retrieveFromLocalJson({ category, description, limit = 8 }) {
  const laws = loadLocalCorpus();
  if (!laws.length) return [];
  const tokens = tokenizeForMatch(description);
  return laws
    .map((law, i) => ({
      id: `local-${i}`,
      content: law.fullText,
      keywords: law.keywords,
      region: law.region || 'National',
      name: law.name,
      citation: law.citation || law.name,
      category: law.category,
      source_url: law.link,
      priority: law.priority || 'medium',
      score: scoreChunk({
        keywords: law.keywords,
        content: law.fullText,
        name: law.name,
        citation: law.citation || law.name,
        category: law.category,
        region: law.region || 'National',
      }, tokens, category),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * @returns {Promise<{ chunks: object[], source: 'supabase'|'prisma'|'local' }>}
 */
export async function retrieveLegalContext({ category, description, limit = 8 }) {
  try {
    const vectorHits = await retrieveFromSupabaseVector({ description, limit });
    if (vectorHits?.length) {
      return { chunks: vectorHits, source: 'supabase-vector' };
    }
    const fromSb = await retrieveFromSupabase({ category, description, limit });
    if (fromSb?.length) {
      return { chunks: fromSb, source: 'supabase' };
    }
  } catch (e) {
    console.warn('[legalCorpus] Supabase retrieve failed:', e.message);
  }

  try {
    const fromDb = await retrieveFromPrisma({ category, description, limit });
    if (fromDb?.length) return { chunks: fromDb, source: 'prisma' };
  } catch (e) {
    console.warn('[legalCorpus] Prisma retrieve failed:', e.message);
  }

  const local = await retrieveFromLocalJson({ category, description, limit });
  return { chunks: local, source: 'local' };
}

export function formatChunksForPrompt(chunks) {
  return chunks.map((c, i) => {
    const status = c.status || 'ACTIVE';
    const priority = c.priority || 'medium';
    const lastChanged = c.last_changed_at ? new Date(c.last_changed_at).toISOString().slice(0, 10) : 'n/a';
    return (
      `[${i + 1}] ID=${c.id} | ${c.name} (${c.citation}) | Region: ${c.region} | Category: ${c.category}\n` +
      `Status: ${status} | Priority: ${priority} | Last updated: ${lastChanged}\n` +
      `URL: ${c.source_url || 'n/a'}\n` +
      `${c.content}`
    );
  }).join('\n\n');
}

/**
 * Summarise the freshness signals of a retrieved chunk set so the
 * orchestrator can surface a caution badge to the UI when sources are
 * stale, amended, or unevenly prioritized.
 */
export function summarizeChunkFreshness(chunks) {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return { total: 0, active: 0, amended: 0, superseded: 0, highPriority: 0, oldestDays: null };
  }
  let active = 0;
  let amended = 0;
  let superseded = 0;
  let highPriority = 0;
  let oldestMs = null;
  const now = Date.now();
  for (const c of chunks) {
    const status = c.status || 'ACTIVE';
    if (status === 'ACTIVE') active++;
    else if (status === 'AMENDED') amended++;
    else if (status === 'SUPERSEDED' || status === 'REPEALED') superseded++;
    if (c.priority === 'high') highPriority++;
    if (c.last_changed_at) {
      const d = new Date(c.last_changed_at).getTime();
      if (!Number.isNaN(d)) {
        const ageMs = now - d;
        if (oldestMs == null || ageMs > oldestMs) oldestMs = ageMs;
      }
    }
  }
  return {
    total: chunks.length,
    active,
    amended,
    superseded,
    highPriority,
    oldestDays: oldestMs == null ? null : Math.floor(oldestMs / (24 * 60 * 60 * 1000)),
  };
}
