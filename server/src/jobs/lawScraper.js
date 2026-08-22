// ============================================================
// Ordinex — Daily Legal Database Auto-Update Scraper
// Checks Official Gazette, LawPhil, and SC E-Library for new
// AND CHANGED laws/decisions, upserting into Prisma LawReference
// (and syncing phLawsExtended.json). Does not use legal_chunks.
//
// Runs daily at 12:00 AM PHT via node-cron (scheduler.js).
// Manual: node src/jobs/lawScraper.js
// ============================================================
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../config/prisma.js';
import { isAllowedPhLegalUrl } from '../utils/phLegalHosts.js';
import { embedLawReference } from '../services/embeddings.js';
import { REPEAL_RE } from './corpusHistoryMiner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SOURCES = {
  officialGazette: {
    name: 'Official Gazette',
    baseUrl: 'https://www.officialgazette.gov.ph',
    feedPath: '/section/republic-acts/',
  },
  lawPhil: {
    name: 'LawPhil Project',
    baseUrl: 'https://www.lawphil.net',
    feedPath: '/statutes/repacts/',
  },
  scELibrary: {
    name: 'SC E-Library',
    baseUrl: 'https://elibrary.judiciary.gov.ph',
    feedPath: '/thebookshelf/docmonth/category/',
  },
};

/**
 * Fetch HTML from a URL with a polite timeout and user-agent.
 * @param {string} url
 * @returns {Promise<string|null>}
 */
async function fetchPage(url, { checkStatus = false } = {}) {
  if (!isAllowedPhLegalUrl(url)) return checkStatus ? { html: null, status: 0 } : null;
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
    if (!res.ok) return checkStatus ? { html: null, status: res.status } : null;
    const html = await res.text();
    return checkStatus ? { html, status: res.status } : html;
  } catch (err) {
    console.warn(`[lawScraper] Failed to fetch ${url}: ${err.message}`);
    return checkStatus ? { html: null, status: 0 } : null;
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
 * Compute a stable content hash so trivial whitespace does not force updates.
 */
function contentHash(text) {
  const canonical = (text || '').replace(/\s+/g, ' ').trim().toLowerCase();
  return crypto.createHash('sha256').update(canonical).digest('hex');
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
 * Look up an existing LawReference by source URL (link) or name.
 */
async function findExistingLaw(url, title) {
  if (url) {
    const byLink = await prisma.lawReference.findFirst({
      where: { link: url },
      select: { id: true, name: true, fullText: true, link: true, keywords: true },
    });
    if (byLink) return byLink;
  }
  if (title) {
    const byName = await prisma.lawReference.findFirst({
      where: { name: { contains: title.slice(0, 80), mode: 'insensitive' } },
      select: { id: true, name: true, fullText: true, link: true, keywords: true },
    });
    if (byName) return byName;
  }
  return null;
}

/**
 * Insert or update a LawReference row from a scraped PH gov page.
 * Corpus lives in Prisma LawReference (+ JSON seed files), not legal_chunks.
 */
async function upsertLaw(law) {
  const keywords = Array.isArray(law.keywords) ? law.keywords.join(', ') : String(law.keywords || '');
  const hash = law.contentHash || contentHash(law.content);
  let corpusStatus = 'ACTIVE';
  if (REPEAL_RE.test(law.content || '')) corpusStatus = 'REPEALED';
  else if (law.amended) corpusStatus = 'AMENDED';

  const payload = {
    name: law.title,
    category: law.category || 'General',
    fullText: law.content.slice(0, 50000),
    link: law.url || null,
    keywords,
    priority: law.priority || 'medium',
    region: law.region || 'National',
    contentHash: hash,
    corpusStatus,
  };

  const existing = await findExistingLaw(law.url, law.title);
  if (!existing) {
    const created = await prisma.lawReference.create({ data: payload });
    console.log(`[lawScraper] ✅ Inserted LawReference "${law.title}"`);
    embedLawReference(created.id).catch(() => {});
    return { id: created.id, status: 'added' };
  }

  const prevHash = existing.fullText ? contentHash(existing.fullText) : '';
  if (prevHash === hash && corpusStatus === 'ACTIVE') {
    return { id: existing.id, status: 'unchanged' };
  }

  await prisma.lawReference.update({
    where: { id: existing.id },
    data: payload,
  });
  console.log(`[lawScraper] ✅ Updated LawReference "${law.title}" (${corpusStatus})`);
  embedLawReference(existing.id).catch(() => {});
  return { id: existing.id, status: corpusStatus === 'REPEALED' ? 'superseded' : 'amended' };
}

/**
 * Scrape a single source feed into LawReference.
 */
async function scrapeSource(sourceKey) {
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
  let superseded = 0;

  for (const link of links) {
    const pageHtml = await fetchPage(link.url);
    if (!pageHtml) { skipped++; continue; }

    const content = extractBodyText(pageHtml);
    if (content.length < 100) { skipped++; continue; }

    const hash = contentHash(content);
    const category = categorizeContent(content);
    const keywords = extractKeywords(content);
    const law = { title: link.title, url: link.url, content, category, keywords, contentHash: hash };

    try {
      const result = await upsertLaw(law);
      if (result.status === 'added') added++;
      else if (result.status === 'amended') amended++;
      else if (result.status === 'superseded') superseded++;
      else unchanged++;
    } catch (err) {
      console.warn(`[lawScraper] Upsert failed for "${link.title}": ${err.message}`);
      skipped++;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log(
    `[lawScraper] ${source.name} → +${added} added · ↻${amended} amended · =${unchanged} unchanged · ×${skipped} skipped` +
    (superseded ? ` · ⚠${superseded} superseded` : ''),
  );
  return { added, amended, unchanged, skipped, superseded };
}

/** Flag stored laws whose gov link returns 404 or shows repeal language. */
async function checkStaleStoredLinks() {
  const rows = await prisma.lawReference.findMany({
    where: { link: { not: null }, corpusStatus: { not: 'REPEALED' } },
    select: { id: true, link: true, name: true },
    take: 40,
  });
  let superseded = 0;
  for (const row of rows) {
    if (!row.link || !isAllowedPhLegalUrl(row.link)) continue;
    const { html, status } = await fetchPage(row.link, { checkStatus: true });
    if (status === 404 || status === 410) {
      await prisma.lawReference.update({
        where: { id: row.id },
        data: { corpusStatus: 'SUPERSEDED', priority: 'low' },
      });
      superseded++;
      continue;
    }
    if (html && REPEAL_RE.test(html)) {
      await prisma.lawReference.update({
        where: { id: row.id },
        data: { corpusStatus: 'REPEALED', priority: 'low' },
      });
      superseded++;
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  return superseded;
}

/** Log top citizen concerns not yet covered in LawReference keywords. */
async function runTopConcernGapCheck() {
  const manifestPath = path.join(__dirname, '../../data/topPhLegalConcerns.json');
  if (!fs.existsSync(manifestPath)) return 0;
  const topics = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const all = await prisma.lawReference.findMany({ select: { keywords: true, name: true, category: true } });
  const hay = all.map((l) => `${l.name} ${l.keywords} ${l.category}`.toLowerCase()).join(' ');
  let gaps = 0;
  for (const t of topics) {
    const tokens = String(t.keywords || t.topic).split(/[\s,]+/).filter((k) => k.length > 3);
    const covered = tokens.some((tok) => hay.includes(tok.toLowerCase()));
    if (!covered) {
      console.log(`[lawScraper] Gap candidate (no preload match): ${t.topic}`);
      gaps++;
    }
  }
  return gaps;
}

/**
 * Main scraper entry point — checks all 3 sources into LawReference.
 */
export async function runLawScraper() {
  const startedAt = new Date();
  console.log(`\n[lawScraper] ════════════════════════════════════════`);
  console.log(`[lawScraper] Daily legal database update started`);
  console.log(`[lawScraper] Time: ${startedAt.toISOString()}`);
  console.log(`[lawScraper] Target: Prisma LawReference (no legal_chunks)`);
  console.log(`[lawScraper] ════════════════════════════════════════\n`);

  const results = {};
  const aggregate = { added: 0, amended: 0, unchanged: 0, skipped: 0, superseded: 0, gapFilled: 0 };

  for (const sourceKey of Object.keys(SOURCES)) {
    try {
      const stats = await scrapeSource(sourceKey);
      results[sourceKey] = { ...stats, error: null };
      aggregate.added += stats.added;
      aggregate.amended += stats.amended;
      aggregate.unchanged += stats.unchanged;
      aggregate.skipped += stats.skipped;
      aggregate.superseded += stats.superseded || 0;
    } catch (err) {
      console.error(`[lawScraper] Error scraping ${sourceKey}: ${err.message}`);
      results[sourceKey] = { added: 0, amended: 0, unchanged: 0, skipped: 0, superseded: 0, error: err.message };
    }
  }

  try {
    aggregate.superseded += await checkStaleStoredLinks();
  } catch (e) {
    console.warn('[lawScraper] Stale link check skipped:', e.message);
  }

  try {
    aggregate.gapFilled = await runTopConcernGapCheck();
  } catch (e) {
    console.warn('[lawScraper] Gap check skipped:', e.message);
  }

  const elapsedMs = Date.now() - startedAt.getTime();
  console.log(`\n[lawScraper] ════════════════════════════════════════`);
  console.log(
    `[lawScraper] Done in ${(elapsedMs / 1000).toFixed(1)}s — ` +
    `+${aggregate.added} added · ↻${aggregate.amended} amended · ` +
    `=${aggregate.unchanged} unchanged · ×${aggregate.skipped} skipped` +
    (aggregate.superseded ? ` · ⚠${aggregate.superseded} superseded` : '') +
    (aggregate.gapFilled ? ` · ${aggregate.gapFilled} gap topics logged` : ''),
  );
  console.log(`[lawScraper] Per-source:`, JSON.stringify(results, null, 2));
  console.log(`[lawScraper] ════════════════════════════════════════\n`);

  if (aggregate.added > 0 || aggregate.amended > 0) {
    try {
      const allLaws = await prisma.lawReference.findMany({
        select: {
          name: true,
          category: true,
          keywords: true,
          fullText: true,
          link: true,
          priority: true,
        },
      });
      if (allLaws.length > 0) {
        const jsonEntries = allLaws.map((law) => ({
          name: law.name,
          category: law.category,
          keywords: law.keywords,
          fullText: law.fullText,
          link: law.link,
          region: 'National',
          priority: law.priority || 'medium',
        }));
        const outPath = path.join(__dirname, '../../prisma/phLawsExtended.json');
        fs.writeFileSync(outPath, JSON.stringify(jsonEntries, null, 2), 'utf-8');
        console.log(`[lawScraper] ✅ Dual sync: exported ${jsonEntries.length} laws to phLawsExtended.json`);
      }
    } catch (syncErr) {
      console.warn(`[lawScraper] Dual sync to local JSON skipped: ${syncErr.message}`);
    }
  }

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
