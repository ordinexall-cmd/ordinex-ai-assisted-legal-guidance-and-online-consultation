/**
 * Live lookup of the public Supreme Court Roll / Lawyers List.
 * Caches hits in Prisma. Does not treat seed-only rows as official matches.
 */
import { prisma } from '../config/prisma.js';

const CACHE_MS = 7 * 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 10000;
const HEADERS = {
  'User-Agent': 'Ordinex-LegalSearch/1.0 (Academic Research)',
  Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
};

const ROLL_UNAVAILABLE_MESSAGE =
  'We could not reach the Supreme Court Lawyers List right now. Please try again in a few minutes.';

function decodeHtml(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseAdmittedAt(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeRoll(value) {
  return String(value || '').replace(/[^\d]/g, '');
}

function looksLikeRoll(value, expected) {
  const a = normalizeRoll(value);
  const b = normalizeRoll(expected);
  return a && b && a === b;
}

function composeFullName({ lastName, firstName, middleName, fullName }) {
  if (fullName) return decodeHtml(fullName);
  const parts = [firstName, middleName, lastName].map((p) => decodeHtml(p)).filter(Boolean);
  return parts.join(' ').trim();
}

function candidateFromCells(cells, rollNumber) {
  const cleaned = cells.map((c) => decodeHtml(c)).filter((c) => c && c !== '—' && c.toLowerCase() !== 'wdt_id');
  while (cleaned.length && /^\d{1,4}$/.test(cleaned[0]) && !looksLikeRoll(cleaned[0], rollNumber)) {
    cleaned.shift();
  }
  if (cleaned.length < 2) return null;
  const rollCell = cleaned.find((c) => looksLikeRoll(c, rollNumber));
  if (!rollCell) return null;
  const lastName = cleaned[0];
  const firstName = cleaned[1];
  const middleName = cleaned.length >= 6 ? cleaned[2] : '';
  const address = cleaned.length >= 6 ? cleaned[3] : (cleaned.length >= 5 ? cleaned[2] : null);
  const signed = cleaned.length >= 6 ? cleaned[4] : (cleaned.length >= 5 ? cleaned[3] : null);
  return {
    rollNumber: normalizeRoll(rollCell),
    fullName: composeFullName({ lastName, firstName, middleName }),
    address: address || null,
    admittedAt: parseAdmittedAt(signed),
    status: 'ACTIVE',
  };
}

function parseTableRows(html, rollNumber) {
  const rows = [];
  const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let tr;
  while ((tr = trRe.exec(html))) {
    const cells = [];
    const cellRe = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cell;
    while ((cell = cellRe.exec(tr[1]))) {
      cells.push(cell[1]);
    }
    const hit = candidateFromCells(cells, rollNumber);
    if (hit) rows.push(hit);
  }
  return rows;
}

function parseJsonPayload(text, rollNumber) {
  try {
    const data = JSON.parse(text);
    const rows = Array.isArray(data) ? data : (data.data || data.aaData || data.rows || []);
    if (!Array.isArray(rows)) return [];
    const hits = [];
    for (const row of rows) {
      if (Array.isArray(row)) {
        const hit = candidateFromCells(row, rollNumber);
        if (hit) hits.push(hit);
        continue;
      }
      if (!row || typeof row !== 'object') continue;
      const roll = row.rollNumber || row.roll_no || row.rollNo || row['Roll no'] || row.wdt_Roll_no;
      if (!looksLikeRoll(roll, rollNumber)) continue;
      hits.push({
        rollNumber: normalizeRoll(roll),
        fullName: composeFullName({
          lastName: row.Lastname || row.lastname || row.lastName,
          firstName: row.Firstname || row.firstname || row.firstName,
          middleName: row['Middle Name'] || row.middleName || row.middlename,
          fullName: row.fullName || row.name,
        }),
        address: row.Address || row.address || null,
        admittedAt: parseAdmittedAt(row['Roll Signed Date'] || row.admittedAt || row.rollSignedDate),
        status: 'ACTIVE',
      });
    }
    return hits;
  } catch {
    return [];
  }
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: HEADERS });
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    console.warn(`[scRollLookup] fetch failed ${url}: ${err.message}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function searchUrls(rollNumber) {
  const q = encodeURIComponent(rollNumber);
  return [
    `https://sc.judiciary.gov.ph/lawyers-list-2/?wdt_search=${q}`,
    `https://sc.judiciary.gov.ph/lawyers-list-2/?wdt_column_filter[6]=${q}`,
    `https://elibrary.judiciary.gov.ph/lawyers_list?wdt_search=${q}`,
    `https://elibrary.judiciary.gov.ph/lawyers_list?s=${q}`,
  ];
}

async function cacheEntry(entry) {
  if (!entry?.rollNumber || !entry.fullName) return entry;
  try {
    return await prisma.rollOfAttorneys.upsert({
      where: { rollNumber: entry.rollNumber },
      create: {
        rollNumber: entry.rollNumber,
        fullName: entry.fullName,
        admittedAt: entry.admittedAt || null,
        status: entry.status || 'ACTIVE',
        address: entry.address || null,
        lastLiveCheckedAt: new Date(),
      },
      update: {
        fullName: entry.fullName,
        admittedAt: entry.admittedAt || undefined,
        status: entry.status || 'ACTIVE',
        address: entry.address || null,
        lastLiveCheckedAt: new Date(),
      },
    });
  } catch (err) {
    console.warn('[scRollLookup] cache write failed:', err.message);
    return { ...entry, lastLiveCheckedAt: new Date() };
  }
}

async function readLiveCache(rollNumber) {
  try {
    const row = await prisma.rollOfAttorneys.findUnique({
      where: { rollNumber },
    });
    if (!row?.lastLiveCheckedAt) return null;
    const age = Date.now() - new Date(row.lastLiveCheckedAt).getTime();
    if (age > CACHE_MS) return { stale: row };
    return { fresh: row };
  } catch {
    return null;
  }
}

/**
 * @param {{ rollNumber: string, fullName?: string }} args
 * @returns {Promise<{ entry: object|null, unavailable?: boolean, message?: string }>}
 */
export async function lookupScRollEntry({ rollNumber, fullName }) {
  const trimmedRoll = String(rollNumber || '').trim();
  if (!trimmedRoll) return { entry: null };

  const cache = await readLiveCache(trimmedRoll);
  if (cache?.fresh) return { entry: cache.fresh };

  let reachedHost = false;
  for (const url of searchUrls(trimmedRoll)) {
    const text = await fetchText(url);
    if (text == null) continue;
    reachedHost = true;
    const hits = [
      ...parseTableRows(text, trimmedRoll),
      ...parseJsonPayload(text, trimmedRoll),
    ];
    const named = fullName
      ? hits.find((h) => h.fullName && h.fullName.toLowerCase().includes(String(fullName).trim().split(/\s+/)[0].toLowerCase())) || hits[0]
      : hits[0];
    if (named?.fullName) {
      const saved = await cacheEntry(named);
      return { entry: saved };
    }
  }

  if (!reachedHost) {
    if (cache?.stale) return { entry: cache.stale };
    return { entry: null, unavailable: true, message: ROLL_UNAVAILABLE_MESSAGE };
  }

  return { entry: null };
}

export async function findSeedRollEntry({ rollNumber, fullName }) {
  const where = {};
  if (rollNumber) where.rollNumber = String(rollNumber).trim();
  if (Object.keys(where).length === 0 && fullName) {
    const rows = await prisma.rollOfAttorneys.findMany({
      where: { fullName: { contains: fullName.trim().split(' ')[0] } },
      take: 5,
    });
    return rows[0] || null;
  }
  try {
    return await prisma.rollOfAttorneys.findUnique({ where });
  } catch {
    return null;
  }
}
