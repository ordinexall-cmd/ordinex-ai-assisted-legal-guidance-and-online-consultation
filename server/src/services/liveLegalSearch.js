/**
 * On-demand live lookup of PH government legal pages when the preloaded
 * corpus cannot ground a signed-in analysis.
 */
import { isAllowedPhLegalUrl } from '../utils/phLegalHosts.js';

const SOURCES = [
  { name: 'Official Gazette', url: 'https://www.officialgazette.gov.ph/section/republic-acts/' },
  { name: 'LawPhil', url: 'https://www.lawphil.net/statutes/repacts/' },
  { name: 'SC E-Library', url: 'https://elibrary.judiciary.gov.ph/thebookshelf/list/1' },
  { name: 'Senate laws', url: 'https://legacy.senate.gov.ph/lis/leg_sys.aspx?congress=19&type=law' },
];

async function fetchPage(url) {
  if (!isAllowedPhLegalUrl(url)) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Ordinex-LegalSearch/1.0 (Academic Research)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    console.warn(`[liveLegalSearch] fetch failed ${url}: ${err.message}`);
    return null;
  }
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreTitle(title, tokens) {
  const hay = (title || '').toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (t.length > 2 && hay.includes(t)) score += 1;
  }
  return score;
}

function extractLinks(html, baseHint) {
  const results = [];
  const re = /<a\s+[^>]*href="([^"]+)"[^>]*>([^<]{8,180})<\/a>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    let href = match[1];
    const title = match[2].replace(/\s+/g, ' ').trim();
    if (!title || href.startsWith('#') || href.startsWith('javascript:')) continue;
    if (href.startsWith('/') && baseHint) {
      try {
        href = new URL(href, baseHint).href;
      } catch {
        continue;
      }
    }
    if (!/^https?:/i.test(href)) continue;
    results.push({ title, url: href });
  }
  return results;
}

/**
 * @param {{ keywords?: string[], description?: string }}
 * @returns {Promise<object[]>} RAG-shaped chunks
 */
export async function retrieveLiveLegalContext({ keywords = [], description = '' } = {}) {
  const tokens = [...keywords, ...(description || '').split(/\s+/)]
    .map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter((t) => t.length > 3)
    .slice(0, 16);
  if (tokens.length === 0) return [];

  const candidates = [];
  for (const src of SOURCES) {
    const html = await fetchPage(src.url);
    if (!html) continue;
    const links = extractLinks(html, src.url)
      .filter((l) => isAllowedPhLegalUrl(l.url))
      .map((l) => ({ ...l, score: scoreTitle(l.title, tokens), source: src.name }))
      .filter((l) => l.score >= 1)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);
    candidates.push(...links);
  }

  const top = candidates.sort((a, b) => b.score - a.score).slice(0, 3);
  const chunks = [];
  for (const item of top) {
    const page = await fetchPage(item.url);
    if (!page) continue;
    const text = stripHtml(page).slice(0, 4000);
    if (text.length < 200) continue;
    chunks.push({
      id: `live-${chunks.length}`,
      name: item.title,
      citation: item.title,
      content: text,
      keywords: tokens.join(', '),
      region: 'National',
      category: 'General',
      source_url: item.url,
      status: 'ACTIVE',
      priority: 'medium',
      score: item.score + 4,
    });
  }
  return chunks;
}
