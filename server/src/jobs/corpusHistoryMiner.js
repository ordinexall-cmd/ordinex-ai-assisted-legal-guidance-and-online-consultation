/**
 * Daily job: re-nourish preloaded library from logged-in consultations
 * that used live PH gov search (second chance if realtime nourish failed).
 */
import { prisma } from '../config/prisma.js';
import { nourishCorpusFromConsultation } from '../services/legalCorpus.js';
import { embedLawReference } from '../services/embeddings.js';

const REPEAL_RE = /\b(repealed|superseded|no longer in effect|revoked)\b/i;

/**
 * @param {{ sinceHours?: number }} opts
 */
export async function runCorpusHistoryMiner({ sinceHours = 24 } = {}) {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
  console.log(`[corpusHistoryMiner] Scanning consultations since ${since.toISOString()}`);

  const rows = await prisma.consultation.findMany({
    where: {
      createdAt: { gte: since },
      deletedAt: null,
      analysisMeta: { not: null },
    },
    select: {
      id: true,
      category: true,
      analysisMeta: true,
      aiResult: true,
    },
    take: 500,
  });

  let nourished = 0;
  let keywordsUpdated = 0;
  let skipped = 0;
  const embeddedIds = new Set();

  for (const row of rows) {
    let meta = {};
    let aiResult = {};
    try { meta = JSON.parse(row.analysisMeta || '{}'); } catch { /* */ }
    try { aiResult = JSON.parse(row.aiResult || '{}'); } catch { /* */ }

    const liveChunks = meta.liveChunks || [];
    const keywords = aiResult.extractedKeywords || [];
    const outcome = meta.outcomeType;

    if (!liveChunks.length || outcome === 'needs_detail') {
      skipped++;
      continue;
    }

    const before = await prisma.lawReference.count();
    await nourishCorpusFromConsultation({
      category: row.category,
      liveChunks,
      keywords,
    });
    const after = await prisma.lawReference.count();
    if (after > before) nourished += after - before;

    // Merge anonymous keywords into existing rows when live chunks reference them
    for (const chunk of liveChunks.slice(0, 1)) {
      if (!chunk?.source_url) continue;
      const existing = await prisma.lawReference.findFirst({
        where: { link: chunk.source_url },
      });
      if (!existing || !keywords.length) continue;
      const existingKw = new Set(
        String(existing.keywords || '').split(',').map((k) => k.trim().toLowerCase()).filter(Boolean),
      );
      let changed = false;
      for (const kw of keywords.slice(0, 8)) {
        const k = String(kw).trim().toLowerCase();
        if (k.length > 2 && !existingKw.has(k)) {
          existingKw.add(k);
          changed = true;
        }
      }
      if (changed) {
        await prisma.lawReference.update({
          where: { id: existing.id },
          data: { keywords: [...existingKw].slice(0, 40).join(', ') },
        });
        keywordsUpdated++;
        embeddedIds.add(existing.id);
      }
    }
  }

  for (const id of embeddedIds) {
    await embedLawReference(id).catch(() => {});
  }

  const report = { nourished, keywordsUpdated, skipped, scanned: rows.length };
  console.log(
    `[corpusHistoryMiner] Done — +${nourished} nourished · ↻${keywordsUpdated} keywords · ×${skipped} skipped · scanned ${rows.length}`,
  );
  return report;
}

export { REPEAL_RE };
