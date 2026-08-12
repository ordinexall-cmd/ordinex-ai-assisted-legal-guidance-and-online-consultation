/**
 * Seed Supabase legal_sources + legal_chunks from phLaws.json + Davao pack.
 * Prerequisite: run supabase/migrations/001_legal_corpus.sql in SQL Editor.
 * Usage: node scripts/seed-legal-supabase.js
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY in server/.env');
    process.exit(1);
  }

  const phLaws = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../prisma/phLaws.json'), 'utf-8'),
  );
  let extendedLaws = [];
  try {
    extendedLaws = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../prisma/phLawsExtended.json'), 'utf-8'),
    );
  } catch {
    extendedLaws = [];
  }
  const davao = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../data/davaoLegalSeed.json'), 'utf-8'),
  );
  const seenNames = new Set();
  const all = [];
  for (const l of [...phLaws, ...extendedLaws, ...davao]) {
    const key = (l.name || '').toLowerCase().trim();
    if (!key || seenNames.has(key)) continue;
    seenNames.add(key);
    all.push({
      ...l,
      region: l.region || 'National',
      citation: l.citation || l.name,
    });
  }
  console.log(`[seed-legal] Loaded ${phLaws.length} base + ${extendedLaws.length} extended + ${davao.length} Davao = ${all.length} unique entries to seed.`);

  const sb = createClient(url, key);

  const { error: delChunks } = await sb.from('legal_chunks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delChunks && delChunks.code !== 'PGRST116') console.warn('clear chunks:', delChunks.message);
  const { error: delSrc } = await sb.from('legal_sources').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delSrc && delSrc.code !== 'PGRST116') console.warn('clear sources:', delSrc.message);

  let inserted = 0;
  for (const law of all) {
    const { data: src, error: srcErr } = await sb
      .from('legal_sources')
      .insert({
        name: law.name,
        citation: law.citation || law.name,
        category: law.category,
        region: law.region || 'National',
        source_url: law.link || null,
      })
      .select('id')
      .single();

    if (srcErr) {
      console.error('source insert failed:', law.name, srcErr.message);
      continue;
    }

    const { error: chunkErr } = await sb.from('legal_chunks').insert({
      source_id: src.id,
      content: law.fullText,
      keywords: law.keywords || '',
      region: law.region || 'National',
    });

    if (chunkErr) {
      console.error('chunk insert failed:', law.name, chunkErr.message);
      continue;
    }
    inserted++;
  }

  console.log(`Seeded ${inserted} legal sources into Supabase.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
