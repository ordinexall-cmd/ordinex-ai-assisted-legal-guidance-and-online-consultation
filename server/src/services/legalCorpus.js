/**
 * Legal knowledge retrieval — Prisma (Neon PostgreSQL) primary, local JSON fallback.
 */
import { prisma } from '../config/prisma.js';
import { tokenizeForMatch } from './textPreprocess.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    .filter((c) => c.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

let localCorpusCache = null;
let localCorpusStamp = '';
function loadLocalCorpus() {
  const basePath = path.join(__dirname, '../../prisma/phLaws.json');
  const extPath = path.join(__dirname, '../../prisma/phLawsExtended.json');
  const stamp = [
    fs.existsSync(basePath) ? fs.statSync(basePath).mtimeMs : 0,
    fs.existsSync(extPath) ? fs.statSync(extPath).mtimeMs : 0,
  ].join(':');
  if (localCorpusCache && stamp === localCorpusStamp) return localCorpusCache;
  localCorpusStamp = stamp;
  localCorpusCache = null;
  const corpus = [];
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
    meetsMinimum: laws.length >= 300,
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
    .filter((c) => c.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Retrieve legal context — Prisma (Neon PostgreSQL) primary, local JSON fallback.
 * @returns {Promise<{ chunks: object[], source: 'prisma'|'local' }>}
 */
export async function retrieveLegalContext({ category, description, limit = 8 }) {
  let fromDb = [];
  try {
    fromDb = await retrieveFromPrisma({ category, description, limit }) || [];
  } catch (e) {
    console.warn('[legalCorpus] Prisma retrieve failed:', e.message);
  }

  const local = await retrieveFromLocalJson({ category, description, limit });
  const byName = new Map();
  for (const chunk of [...fromDb, ...local]) {
    const key = (chunk.name || chunk.citation || '').toLowerCase().trim();
    if (!key) continue;
    const prev = byName.get(key);
    if (!prev || (chunk.score || 0) > (prev.score || 0)) byName.set(key, chunk);
  }
  const chunks = [...byName.values()]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, limit);
  return { chunks, source: fromDb.length ? 'prisma' : 'local' };
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

/**
 * Nourish the legal knowledge base from validated citizen consultations.
 * If a validated case has new keywords or represents an unusual legal scenario,
 * this automatically updates the database and local JSON cache.
 */
export async function nourishCorpusFromConsultation({ category, aiResult, description }) {
  try {
    if (!aiResult || !Array.isArray(aiResult.possibleLegalCases) || aiResult.possibleLegalCases.length === 0) {
      return;
    }
    const topCase = aiResult.possibleLegalCases[0];
    if ((topCase.confidenceScore || 0) < 65 || !topCase.name) {
      return;
    }

    const keywords = (aiResult.extractedKeywords || [])
      .map((k) => (k || '').trim().toLowerCase())
      .filter((k) => k.length > 2);

    if (keywords.length === 0) return;

    // 1. Check if law already exists in Prisma DB
    const existing = await prisma.lawReference.findFirst({
      where: {
        OR: [
          { name: { equals: topCase.name } },
          { name: { contains: topCase.name } },
        ],
      },
    });

    if (existing) {
      const existingKw = (existing.keywords || '').split(',').map((k) => k.trim().toLowerCase());
      const newKw = keywords.filter((k) => !existingKw.includes(k));
      if (newKw.length > 0) {
        const mergedKw = [...existingKw, ...newKw].join(', ');
        await prisma.lawReference.update({
          where: { id: existing.id },
          data: { keywords: mergedKw },
        });
        console.log(`[legalCorpus] 🧠 Nourished existing law "${existing.name}" with keywords: ${newKw.join(', ')}`);
      }
    } else if (topCase.applicableLaw && topCase.explanation) {
      // Create a new LawReference entry for this unusual scenario
      const created = await prisma.lawReference.create({
        data: {
          category: category || 'General',
          name: topCase.name,
          fullText: `${topCase.applicableLaw}: ${topCase.explanation}`,
          link: topCase.sourceLink || null,
          keywords: keywords.join(', '),
        },
      });
      console.log(`[legalCorpus] 🧠 Added new verified legal reference "${created.name}" from citizen consultation.`);
    }
  } catch (err) {
    console.warn('[legalCorpus] Corpus nourishment skipped:', err.message);
  }
}
