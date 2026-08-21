/**
 * Legal knowledge retrieval — Prisma (PostgreSQL) primary, local JSON fallback.
 */
import { isAllowedPhLegalUrl } from '../utils/phLegalHosts.js';
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
  if (chunk.priority === 'high') score += 4;
  if (chunk.priority === 'low') score -= 2;
  return score;
}

function parseGuidance(law) {
  if (law?.guidanceJson) {
    try {
      const g = JSON.parse(law.guidanceJson);
      return {
        suggestedNextSteps: g.suggestedNextSteps || [],
        documentsNeeded: g.documentsNeeded || [],
        cautions: g.cautions || [],
        recommendedAgency: g.recommendedAgency || '',
      };
    } catch { /* fall through */ }
  }
  return {
    suggestedNextSteps: law.suggestedNextSteps || [],
    documentsNeeded: law.documentsNeeded || [],
    cautions: law.cautions || [],
    recommendedAgency: law.recommendedAgency || '',
  };
}

async function retrieveFromPrisma({ category, description, limit = 8 }) {
  const where = category && category !== 'unsure' ? { category: { contains: category } } : {};
  const rows = await prisma.lawReference.findMany({ where, take: 50 });
  const tokens = tokenizeForMatch(description);

  return rows
    .map((law) => {
      const g = parseGuidance(law);
      return {
        id: law.id,
        content: law.fullText,
        keywords: law.keywords,
        region: 'National',
        name: law.name,
        citation: law.name,
        category: law.category,
        source_url: law.link,
        priority: law.priority || 'medium',
        suggestedNextSteps: g.suggestedNextSteps,
        documentsNeeded: g.documentsNeeded,
        cautions: g.cautions,
        recommendedAgency: g.recommendedAgency,
        score: scoreChunk({
          keywords: law.keywords,
          content: law.fullText,
          name: law.name,
          citation: law.name,
          category: law.category,
          region: 'National',
          priority: law.priority || 'medium',
        }, tokens, category),
      };
    })
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
    .map((law, i) => {
      const g = parseGuidance(law);
      return {
        id: `local-${i}`,
        content: law.fullText,
        keywords: law.keywords,
        region: law.region || 'National',
        name: law.name,
        citation: law.citation || law.name,
        category: law.category,
        source_url: law.link,
        priority: law.priority || 'medium',
        suggestedNextSteps: g.suggestedNextSteps,
        documentsNeeded: g.documentsNeeded,
        cautions: g.cautions,
        recommendedAgency: g.recommendedAgency,
        score: scoreChunk({
          keywords: law.keywords,
          content: law.fullText,
          name: law.name,
          citation: law.citation || law.name,
          category: law.category,
          region: law.region || 'National',
          priority: law.priority || 'medium',
        }, tokens, category),
      };
    })
    .filter((c) => c.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Retrieve legal context — Prisma (PostgreSQL) primary, local JSON fallback.
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
    if (!prev || (chunk.score || 0) > (prev.score || 0)) {
      const merged = { ...chunk };
      if (prev?.suggestedNextSteps?.length && !merged.suggestedNextSteps?.length) {
        merged.suggestedNextSteps = prev.suggestedNextSteps;
        merged.documentsNeeded = prev.documentsNeeded;
        merged.cautions = prev.cautions;
        merged.recommendedAgency = prev.recommendedAgency || merged.recommendedAgency;
      }
      byName.set(key, merged);
    } else if (chunk.suggestedNextSteps?.length && !prev.suggestedNextSteps?.length) {
      byName.set(key, {
        ...prev,
        suggestedNextSteps: chunk.suggestedNextSteps,
        documentsNeeded: chunk.documentsNeeded,
        cautions: chunk.cautions,
        recommendedAgency: chunk.recommendedAgency || prev.recommendedAgency,
        priority: chunk.priority || prev.priority,
      });
    }
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
      (c.suggestedNextSteps?.length ? `LIBRARY_STEPS: ${c.suggestedNextSteps.join(' | ')}\n` : '') +
      (c.documentsNeeded?.length ? `LIBRARY_DOCUMENTS: ${c.documentsNeeded.join(' | ')}\n` : '') +
      (c.cautions?.length ? `LIBRARY_CAUTIONS: ${c.cautions.join(' | ')}\n` : '') +
      (c.recommendedAgency ? `LIBRARY_AGENCY: ${c.recommendedAgency}\n` : '') +
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
 * Save live-search page excerpts from allowlisted PH legal sites into the library.
 * Does not insert model-written case names as if they were statutes.
 */
export async function nourishCorpusFromConsultation({ category, liveChunks = [], keywords = [] }) {
  try {
    const allowed = (liveChunks || []).filter(
      (c) => isAllowedPhLegalUrl(c.source_url) && String(c.content || '').length > 200,
    );
    if (!allowed.length) return;

    const kw = (keywords || []).map((k) => String(k).trim().toLowerCase()).filter((k) => k.length > 2);

    for (const chunk of allowed.slice(0, 2)) {
      const existing = await prisma.lawReference.findFirst({
        where: {
          OR: [
            { link: chunk.source_url },
            { name: { equals: String(chunk.name || '').slice(0, 200) } },
          ],
        },
      });
      if (existing) continue;

      const guidance = {
        suggestedNextSteps: chunk.suggestedNextSteps || [],
        documentsNeeded: chunk.documentsNeeded || [],
        cautions: chunk.cautions || [],
        recommendedAgency: chunk.recommendedAgency || '',
      };

      await prisma.lawReference.create({
        data: {
          category: category || chunk.category || 'General',
          name: String(chunk.name || chunk.citation || 'PH legal source').slice(0, 220),
          fullText: String(chunk.content).slice(0, 6000),
          link: chunk.source_url,
          keywords: kw.join(', ') || (chunk.keywords || ''),
          priority: 'medium',
          guidanceJson: JSON.stringify(guidance),
        },
      });
      console.log(`[legalCorpus] Saved live excerpt "${chunk.name}" from allowlisted source`);
    }
  } catch (err) {
    console.warn('[legalCorpus] Corpus nourishment skipped:', err.message);
  }
}
