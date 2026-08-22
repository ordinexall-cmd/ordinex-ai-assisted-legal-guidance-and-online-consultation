/**
 * Legal knowledge retrieval — hybrid keyword + vector RAG.
 * Prisma (PostgreSQL) primary, local JSON fallback.
 */
import { isAllowedPhLegalUrl } from '../utils/phLegalHosts.js';
import { prisma } from '../config/prisma.js';
import { tokenizeForMatch } from './textPreprocess.js';
import { vectorSearchLegalChunks, embedLawReference } from './embeddings.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REGION_MARKERS = {
  Davao: /\bdavao\b/i,
  Luzon: /\b(manila|quezon|cebu city|baguio|luzon|ncr|metro manila)\b/i,
  Visayas: /\b(visayas|iloilo|cebu|bohol|negros)\b/i,
  Mindanao: /\b(mindanao|zamboanga|gensan|general santos|cagayan de oro)\b/i,
};

function detectRegionFromText(text) {
  const t = String(text || '');
  for (const [region, re] of Object.entries(REGION_MARKERS)) {
    if (re.test(t)) return region;
  }
  return null;
}

function scoreChunk(chunk, tokens, category, regionHint) {
  const hay = `${chunk.keywords} ${chunk.content} ${chunk.name} ${chunk.citation} ${chunk.category}`.toLowerCase();
  let score = chunk.score || 0;
  for (const tok of tokens) {
    if (hay.includes(tok)) score += 2;
  }
  if (category && category !== 'unsure' && chunk.category?.toLowerCase().includes(category.toLowerCase())) {
    score += 3;
  }
  if (regionHint && chunk.region === regionHint) score += 2;
  if (chunk.region === 'Davao') score += 1;
  if (chunk.priority === 'high') score += 4;
  if (chunk.priority === 'low') score -= 2;
  if (chunk.status === 'SUPERSEDED' || chunk.status === 'REPEALED') score -= 3;
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
        concernSummary: g.concernSummary || '',
        penaltiesSummary: g.penaltiesSummary || '',
      };
    } catch { /* fall through */ }
  }
  return {
    suggestedNextSteps: law.suggestedNextSteps || [],
    documentsNeeded: law.documentsNeeded || [],
    cautions: law.cautions || [],
    recommendedAgency: law.recommendedAgency || '',
    concernSummary: '',
    penaltiesSummary: '',
  };
}

function lawRowToChunk(law, extra = {}) {
  const g = parseGuidance(law);
  return {
    id: law.id,
    content: law.fullText,
    keywords: law.keywords,
    region: law.region || 'National',
    name: law.name,
    citation: law.name,
    category: law.category,
    source_url: law.link,
    priority: law.priority || 'medium',
    status: law.corpusStatus || 'ACTIVE',
    suggestedNextSteps: g.suggestedNextSteps,
    documentsNeeded: g.documentsNeeded,
    cautions: g.cautions,
    recommendedAgency: g.recommendedAgency,
    ...extra,
  };
}

async function retrieveKeywordFromPrisma({ category, description, limit, regionHint }) {
  const where = category && category !== 'unsure' ? { category: { contains: category } } : {};
  const rows = await prisma.lawReference.findMany({
    where: { ...where, corpusStatus: { not: 'REPEALED' } },
    take: 80,
  });
  const tokens = tokenizeForMatch(description);

  return rows
    .map((law) => {
      const chunk = lawRowToChunk(law);
      chunk.score = scoreChunk(chunk, tokens, category, regionHint);
      chunk.matchSource = 'keyword';
      return chunk;
    })
    .filter((c) => c.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

async function retrieveVectorFromPrisma({ category, description, limit }) {
  const hits = await vectorSearchLegalChunks(description, { limit: limit * 2, category });
  if (!hits.length) return [];

  const ids = [...new Set(hits.map((h) => h.lawReferenceId))];
  const laws = await prisma.lawReference.findMany({ where: { id: { in: ids } } });
  const byId = new Map(laws.map((l) => [l.id, l]));

  return hits
    .map((h) => {
      const law = byId.get(h.lawReferenceId);
      if (!law) return null;
      const chunk = lawRowToChunk(law, { score: h.score, matchSource: 'vector' });
      return chunk;
    })
    .filter(Boolean)
    .slice(0, limit);
}

function mergeRetrievalResults(keywordChunks, vectorChunks, limit) {
  const byId = new Map();

  for (const chunk of [...keywordChunks, ...vectorChunks]) {
    const key = chunk.id || (chunk.name || '').toLowerCase();
    const prev = byId.get(key);
    if (!prev) {
      byId.set(key, { ...chunk });
      continue;
    }
    const mergedScore = (prev.score || 0) + (chunk.score || 0) * (chunk.matchSource === 'vector' ? 0.9 : 1);
    const sources = new Set([prev.matchSource, chunk.matchSource].filter(Boolean));
    byId.set(key, {
      ...prev,
      ...chunk,
      score: mergedScore + (sources.size > 1 ? 3 : 0),
      matchSource: sources.size > 1 ? 'hybrid' : (prev.matchSource || chunk.matchSource),
      suggestedNextSteps: prev.suggestedNextSteps?.length ? prev.suggestedNextSteps : chunk.suggestedNextSteps,
      documentsNeeded: prev.documentsNeeded?.length ? prev.documentsNeeded : chunk.documentsNeeded,
    });
  }

  return [...byId.values()]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
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

async function retrieveFromLocalJson({ category, description, limit, regionHint }) {
  const laws = loadLocalCorpus();
  if (!laws.length) return [];
  const tokens = tokenizeForMatch(description);
  return laws
    .map((law, i) => {
      const g = parseGuidance(law);
      const chunk = {
        id: `local-${i}`,
        content: law.fullText,
        keywords: law.keywords,
        region: law.region || 'National',
        name: law.name,
        citation: law.citation || law.name,
        category: law.category,
        source_url: law.link,
        priority: law.priority || 'medium',
        status: 'ACTIVE',
        suggestedNextSteps: g.suggestedNextSteps,
        documentsNeeded: g.documentsNeeded,
        cautions: g.cautions,
        recommendedAgency: g.recommendedAgency,
        matchSource: 'keyword',
      };
      chunk.score = scoreChunk(chunk, tokens, category, regionHint);
      return chunk;
    })
    .filter((c) => c.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Hybrid retrieve — keyword + vector (when embeddings exist), JSON fallback.
 */
export async function retrieveLegalContext({ category, description, limit = 8 }) {
  const regionHint = detectRegionFromText(description);
  let keywordDb = [];
  let vectorDb = [];

  try {
    [keywordDb, vectorDb] = await Promise.all([
      retrieveKeywordFromPrisma({ category, description, limit, regionHint }),
      retrieveVectorFromPrisma({ category, description, limit }),
    ]);
  } catch (e) {
    console.warn('[legalCorpus] Prisma retrieve failed:', e.message);
  }

  const fromDb = mergeRetrievalResults(keywordDb, vectorDb, limit);
  const local = await retrieveFromLocalJson({ category, description, limit, regionHint });

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
    }
  }

  const chunks = [...byName.values()]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, limit);

  const source = fromDb.length ? (vectorDb.length ? 'hybrid' : 'prisma') : 'local';
  return { chunks, source };
}

export function formatChunksForPrompt(chunks) {
  return chunks.map((c, i) => {
    const status = c.status || 'ACTIVE';
    const priority = c.priority || 'medium';
    return (
      `[${i + 1}] ID=${c.id} | ${c.name} (${c.citation}) | Region: ${c.region} | Category: ${c.category}\n` +
      `Status: ${status} | Priority: ${priority} | Match: ${c.matchSource || 'keyword'}\n` +
      `URL: ${c.source_url || 'n/a'}\n` +
      (c.suggestedNextSteps?.length ? `LIBRARY_STEPS: ${c.suggestedNextSteps.join(' | ')}\n` : '') +
      (c.documentsNeeded?.length ? `LIBRARY_DOCUMENTS: ${c.documentsNeeded.join(' | ')}\n` : '') +
      (c.cautions?.length ? `LIBRARY_CAUTIONS: ${c.cautions.join(' | ')}\n` : '') +
      (c.recommendedAgency ? `LIBRARY_AGENCY: ${c.recommendedAgency}\n` : '') +
      `${c.content}`
    );
  }).join('\n\n');
}

export function summarizeChunkFreshness(chunks) {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return { total: 0, active: 0, amended: 0, superseded: 0, highPriority: 0, oldestDays: null };
  }
  let active = 0;
  let amended = 0;
  let superseded = 0;
  let highPriority = 0;
  for (const c of chunks) {
    const status = c.status || 'ACTIVE';
    if (status === 'ACTIVE') active++;
    else if (status === 'AMENDED') amended++;
    else if (status === 'SUPERSEDED' || status === 'REPEALED') superseded++;
    if (c.priority === 'high') highPriority++;
  }
  return { total: chunks.length, active, amended, superseded, highPriority, oldestDays: null };
}

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

      const created = await prisma.lawReference.create({
        data: {
          category: category || chunk.category || 'General',
          name: String(chunk.name || chunk.citation || 'PH legal source').slice(0, 220),
          fullText: String(chunk.content).slice(0, 6000),
          link: chunk.source_url,
          keywords: kw.join(', ') || (chunk.keywords || ''),
          priority: 'medium',
          region: chunk.region || 'National',
          corpusStatus: 'ACTIVE',
          guidanceJson: JSON.stringify(guidance),
        },
      });
      console.log(`[legalCorpus] Saved live excerpt "${chunk.name}" from allowlisted source`);
      embedLawReference(created.id).catch((e) => {
        console.warn('[legalCorpus] embed after nourish skipped:', e.message);
      });
    }
  } catch (err) {
    console.warn('[legalCorpus] Corpus nourishment skipped:', err.message);
  }
}
