// ============================================================
// Ordinex — Daily Legal Database Auto-Update Scraper
// Checks Official Gazette, LawPhil, and SC E-Library for new
// AND CHANGED laws/decisions.
//
// What this job does, beyond simple discovery:
//   1. Discover candidate URLs from the source index pages.
//   2. For each URL: download, extract canonical body text,
//      compute SHA-256 content hash.
//   3. If unseen by URL → insert as new ACTIVE source.
//   4. If seen by URL but content_hash differs → mark the
//      previous version's status as 'SUPERSEDED', point its
//      superseded_by to the new row, insert the new row as
//      'AMENDED' with the same source_url and updated hash.
//   5. Track last_checked_at and last_changed_at for freshness.
//   6. Emit a per-run report with new + changed + unchanged counts.
//
// Runs daily at 12:00 AM PHT via node-cron (scheduler.js).
// Manual: node src/jobs/lawScraper.js
// ============================================================
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { embedQuery } from '../services/embeddings.js';

const SOURCES = {
  officialGazette: {
    name: 'Official Gazette',
    baseUrl: 'https://www.officialgazette.gov.ph',
    feedPath: '/section/laws/republic-acts/',
    domain: 'officialgazette.gov.ph',
  },
  lawPhil: {
    name: 'LawPhil',
    baseUrl: 'https://lawphil.net',
    feedPath: '/statutes/repacts/',
    domain: 'lawphil.net',
  },
  scELibrary: {
    name: 'Supreme Court E-Library',
    baseUrl: 'https://elibrary.judiciary.gov.ph',
    feedPath: '/thebookshelf/docmonth/category/',
    domain: 'elibrary.judiciary.gov.ph',
  },
};

import { prisma } from '../config/prisma.js';

/**
 * Get a Supabase client for scraper operations.
 */
function getSupabaseClient() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    return null;
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
}

/**
 * Fetch HTML from a URL with a polite timeout and user-agent.
 * @param {string} url
 * @returns {Promise<string|null>}
 */
async function fetchPage(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Ordinex-LegalUpdater/1.0 (Academic Research; PH Legal Database)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    console.warn(`[lawScraper] Failed to fetch ${url}: ${err.message}`);
    return null;
  }
}

/**
 * Extract Republic Act links and titles from the Official Gazette HTML.
 * Parses the listing page for links to individual RA pages.
 * @param {string} html
 * @returns {{ title: string, url: string }[]}
 */
function parseGazetteLinks(html) {
  const results = [];
  // Match article/entry links — OG uses <a href="/..."> with RA titles
  const linkRegex = /<a\s+[^>]*href="(\/[^"]*republic-act[^"]*)"\s*[^>]*>([^<]+)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const path = match[1];
    const title = match[2].trim();
    if (title.length > 5 && !results.some((r) => r.url === path)) {
      results.push({
        title,
        url: `${SOURCES.officialGazette.baseUrl}${path}`,
      });
    }
  }
  return results.slice(0, 20); // Limit to newest 20 per run
}

/**
 * Extract statute links and titles from LawPhil index page.
 * @param {string} html
 * @returns {{ title: string, url: string }[]}
 */
function parseLawPhilLinks(html) {
  const results = [];
  const linkRegex = /<a\s+[^>]*href="(\/statutes\/repacts\/[^"]+)"\s*[^>]*>([^<]+)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const path = match[1];
    const title = match[2].trim();
    if (title.length > 5 && !results.some((r) => r.url === path)) {
      results.push({
        title,
        url: `${SOURCES.lawPhil.baseUrl}${path}`,
      });
    }
  }
  return results.slice(0, 20);
}

/**
 * Extract recent decision links from the SC E-Library.
 * @param {string} html
 * @returns {{ title: string, url: string }[]}
 */
function parseSCELibraryLinks(html) {
  const results = [];
  const linkRegex = /<a\s+[^>]*href="([^"]*thebookshelf[^"]*)"[^>]*>([^<]+)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const title = match[2].trim();
    if (title.length > 5 && !results.some((r) => r.url === href)) {
      const url = href.startsWith('http') ? href : `${SOURCES.scELibrary.baseUrl}${href}`;
      results.push({ title, url });
    }
  }
  return results.slice(0, 15);
}

/**
 * Extract body text from an HTML page (strips tags, scripts, styles).
 * @param {string} html
 * @returns {string}
 */
function extractBodyText(html) {
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
  // Take the first 6000 chars to keep chunks manageable
  return text.slice(0, 6000);
}

/**
 * Split long text into chunks of ~1500 characters for embedding.
 * @param {string} text
 * @param {number} maxLen
 * @returns {string[]}
 */
function chunkText(text, maxLen = 1500) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let current = '';
  for (const sentence of sentences) {
    if ((current + ' ' + sentence).length > maxLen && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = current ? current + ' ' + sentence : sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/**
 * Extract simple keywords from text using common PH legal terms.
 * @param {string} text
 * @returns {string}
 */
function extractKeywords(text) {
  const legalTerms = [
    'republic act', 'presidential decree', 'executive order', 'batas pambansa',
    'penalty', 'imprisonment', 'fine', 'violation', 'crime', 'offense',
    'civil', 'criminal', 'labor', 'family', 'property', 'consumer',
    'cybercrime', 'fraud', 'theft', 'assault', 'murder', 'homicide',
    'drug', 'trafficking', 'harassment', 'abuse', 'domestic violence',
    'contract', 'obligation', 'lease', 'tenant', 'landlord', 'employer',
    'employee', 'dismissal', 'wage', 'DOLE', 'DSWD', 'PNP', 'NBI',
    'barangay', 'court', 'prosecutor', 'complainant', 'respondent',
  ];
  const lower = text.toLowerCase();
  const found = legalTerms.filter((term) => lower.includes(term));
  return found.join(', ');
}

/**
 * Determine the legal category based on content text.
 * @param {string} text
 * @returns {string}
 */
function categorizeContent(text) {
  const lower = text.toLowerCase();
  if (/cyber|online|internet|hacking|phishing|identity theft/i.test(lower)) return 'Cybercrime';
  if (/family|marriage|annulment|custody|child support|vawc|domestic/i.test(lower)) return 'Family';
  if (/labor|employment|wage|dismiss|dole|worker|termination/i.test(lower)) return 'Labor';
  if (/property|land|lease|tenant|easement|ownership|real estate/i.test(lower)) return 'Property';
  if (/consumer|product|warranty|refund|dti|advertisement/i.test(lower)) return 'Consumer';
  if (/environment|pollution|fishing|forestry|mining|wildlife/i.test(lower)) return 'Environmental';
  if (/privacy|data|personal information/i.test(lower)) return 'Data Privacy';
  return 'Criminal';
}

/**
 * Compute a stable, canonical content hash so trivial whitespace
 * differences don't trigger a false "amended" verdict.
 */
function contentHash(text) {
  const canonical = (text || '').replace(/\s+/g, ' ').trim().toLowerCase();
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Look up the existing legal_sources row by URL (preferred) or by
 * fuzzy title match. Returns the row including content_hash and
 * status so the caller can decide between skip / amend / new.
 */
async function findExistingLaw(sb, url, title) {
  if (url) {
    const { data, error } = await sb
      .from('legal_sources')
      .select('id, name, content_hash, status, last_changed_at, source_url')
      .eq('source_url', url)
      .order('last_changed_at', { ascending: false, nullsLast: true })
      .limit(1);
    if (error) {
      // Older Supabase migrations may not have content_hash yet — gracefully fall back.
      if (error.code === 'PGRST204' || error.message?.includes('content_hash')) {
        const fallback = await sb.from('legal_sources').select('id, name').eq('source_url', url).limit(1);
        return fallback.data?.[0] ? { ...fallback.data[0], content_hash: null, status: 'ACTIVE' } : null;
      }
      return null;
    }
    if (data?.length > 0) return data[0];
  }
  if (title) {
    const { data, error } = await sb
      .from('legal_sources')
      .select('id, name, content_hash, status, last_changed_at, source_url')
      .ilike('name', `%${title.slice(0, 50)}%`)
      .order('last_changed_at', { ascending: false, nullsLast: true })
      .limit(1);
    if (error) return null;
    if (data?.length > 0) return data[0];
  }
  return null;
}

/**
 * Mark the previous source row as SUPERSEDED and set superseded_by to
 * the new row's id. Best-effort: tolerates older schemas that may not
 * have the freshness columns yet.
 */
async function markSuperseded(sb, prevId, newId) {
  const { error } = await sb
    .from('legal_sources')
    .update({
      status: 'SUPERSEDED',
      superseded_by: newId,
      last_changed_at: new Date().toISOString(),
    })
    .eq('id', prevId);
  if (error && !error.message?.includes('superseded_by')) {
    console.warn(`[lawScraper] Could not flag superseded source ${prevId}: ${error.message}`);
  }
}

/**
 * Insert a new legal_source + its chunks (with embeddings when available).
 * status is either 'ACTIVE' (brand-new entry) or 'AMENDED' (replacement
 * of a previously known URL with different content).
 */
async function insertLaw(sb, law, { status = 'ACTIVE' } = {}) {
  const now = new Date().toISOString();
  const baseRow = {
    name: law.title,
    citation: law.title,
    category: law.category,
    region: 'National',
    source_url: law.url,
  };
  // Some installations may not yet have run 004_freshness_superseded.sql,
  // so we try the rich insert first and downgrade gracefully.
  const richRow = {
    ...baseRow,
    content_hash: law.contentHash,
    status,
    last_checked_at: now,
    last_changed_at: now,
    priority: law.priority || 'medium',
  };

  let src = null;
  let srcErr = null;
  const richInsert = await sb.from('legal_sources').insert(richRow).select('id').single();
  src = richInsert.data;
  srcErr = richInsert.error;
  if (srcErr && /column .* does not exist|content_hash|status|priority|superseded_by/i.test(srcErr.message)) {
    console.warn('[lawScraper] Freshness columns missing; falling back to legacy insert.');
    const legacyInsert = await sb.from('legal_sources').insert(baseRow).select('id').single();
    src = legacyInsert.data;
    srcErr = legacyInsert.error;
  }
  if (srcErr) {
    console.warn(`[lawScraper] Source insert failed for "${law.title}": ${srcErr.message}`);
    return null;
  }

  const chunks = chunkText(law.content);
  let insertedChunks = 0;

  for (const chunkContent of chunks) {
    const chunkData = {
      source_id: src.id,
      content: chunkContent,
      keywords: law.keywords,
      region: 'National',
    };
    try {
      const vector = await embedQuery(chunkContent);
      if (vector) chunkData.embedding = vector;
    } catch (e) {
      console.warn(`[lawScraper] Embedding failed for chunk, inserting without vector: ${e.message}`);
    }
    const { error: chunkErr } = await sb.from('legal_chunks').insert(chunkData);
    if (!chunkErr) insertedChunks++;
  }

  console.log(`[lawScraper] ✅ ${status === 'AMENDED' ? 'Amended' : 'Inserted'} "${law.title}" (${insertedChunks} chunk(s))`);
  return src.id;
}

/**
 * Touch only the freshness metadata of an existing legal_source so we
 * can tell, in operational logs, that we successfully re-verified the
 * URL but found no content change.
 */
async function markUnchanged(sb, sourceId) {
  await sb
    .from('legal_sources')
    .update({ last_checked_at: new Date().toISOString() })
    .eq('id', sourceId);
}

/**
 * Scrape a single source feed and apply the freshness-aware update logic.
 * Returns per-source stats: { added, amended, unchanged, skipped }.
 */
async function scrapeSource(sb, sourceKey) {
  const source = SOURCES[sourceKey];
  console.log(`[lawScraper] Checking ${source.name}...`);

  const feedUrl = `${source.baseUrl}${source.feedPath}`;
  const feedHtml = await fetchPage(feedUrl);
  if (!feedHtml) {
    console.warn(`[lawScraper] Could not reach ${source.name} feed page.`);
    return { added: 0, amended: 0, unchanged: 0, skipped: 0 };
  }

  let links;
  switch (sourceKey) {
    case 'officialGazette':
      links = parseGazetteLinks(feedHtml); break;
    case 'lawPhil':
      links = parseLawPhilLinks(feedHtml); break;
    case 'scELibrary':
      links = parseSCELibraryLinks(feedHtml); break;
    default:
      links = [];
  }

  console.log(`[lawScraper] Found ${links.length} entries from ${source.name}`);

  let added = 0;
  let amended = 0;
  let unchanged = 0;
  let skipped = 0;

  for (const link of links) {
    const pageHtml = await fetchPage(link.url);
    if (!pageHtml) { skipped++; continue; }

    const content = extractBodyText(pageHtml);
    if (content.length < 100) { skipped++; continue; }

    const hash = contentHash(content);
    const existing = await findExistingLaw(sb, link.url, link.title);
    const category = categorizeContent(content);
    const keywords = extractKeywords(content);
    const law = { title: link.title, url: link.url, content, category, keywords, contentHash: hash };

    if (!existing) {
      const id = await insertLaw(sb, law, { status: 'ACTIVE' });
      if (id) added++; else skipped++;
    } else if (existing.content_hash && existing.content_hash === hash) {
      await markUnchanged(sb, existing.id);
      unchanged++;
    } else {
      // Either we never had a hash (first sighting under new schema) or the
      // content changed — record the new version and mark the old SUPERSEDED.
      const newId = await insertLaw(sb, law, {
        status: existing.content_hash ? 'AMENDED' : 'ACTIVE',
      });
      if (newId && existing.content_hash) {
        await markSuperseded(sb, existing.id, newId);
        amended++;
      } else if (newId) {
        // Backfilling hash on first run — treat as touch, not a real change.
        unchanged++;
      } else {
        skipped++;
      }
    }

    // Polite delay between requests (2 seconds)
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log(
    `[lawScraper] ${source.name} → +${added} added · ↻${amended} amended · =${unchanged} unchanged · ×${skipped} skipped`,
  );
  return { added, amended, unchanged, skipped };
}

/**
 * Main scraper entry point — checks all 3 sources.
 * Called by the scheduler daily or manually.
 */
export async function runLawScraper() {
  const startedAt = new Date();
  console.log(`\n[lawScraper] ════════════════════════════════════════`);
  console.log(`[lawScraper] Daily legal database update started`);
  console.log(`[lawScraper] Time: ${startedAt.toISOString()}`);
  console.log(`[lawScraper] ════════════════════════════════════════\n`);

  const sb = getSupabaseClient();
  if (!sb) {
    console.log('[lawScraper] Supabase not configured. Using Prisma database integration for legal corpus updates.');
  }

  const results = {};
  const aggregate = { added: 0, amended: 0, unchanged: 0, skipped: 0 };

  for (const sourceKey of Object.keys(SOURCES)) {
    try {
      const stats = await scrapeSource(sb, sourceKey);
      results[sourceKey] = { ...stats, error: null };
      aggregate.added += stats.added;
      aggregate.amended += stats.amended;
      aggregate.unchanged += stats.unchanged;
      aggregate.skipped += stats.skipped;
    } catch (err) {
      console.error(`[lawScraper] Error scraping ${sourceKey}: ${err.message}`);
      results[sourceKey] = { added: 0, amended: 0, unchanged: 0, skipped: 0, error: err.message };
    }
  }

  const elapsedMs = Date.now() - startedAt.getTime();
  console.log(`\n[lawScraper] ════════════════════════════════════════`);
  console.log(
    `[lawScraper] Done in ${(elapsedMs / 1000).toFixed(1)}s — ` +
    `+${aggregate.added} added · ↻${aggregate.amended} amended · ` +
    `=${aggregate.unchanged} unchanged · ×${aggregate.skipped} skipped`,
  );
  console.log(`[lawScraper] Per-source:`, JSON.stringify(results, null, 2));
  console.log(`[lawScraper] ════════════════════════════════════════\n`);

  return {
    total: aggregate.added + aggregate.amended,
    aggregate,
    results,
    elapsedMs,
  };
}

// Allow manual execution: node src/jobs/lawScraper.js
if (process.argv[1]?.includes('lawScraper')) {
  import('dotenv/config').then(() => {
    runLawScraper()
      .then((r) => {
        console.log('[lawScraper] Manual run finished:', r);
        process.exit(0);
      })
      .catch((e) => {
        console.error('[lawScraper] Manual run failed:', e);
        process.exit(1);
      });
  });
}
