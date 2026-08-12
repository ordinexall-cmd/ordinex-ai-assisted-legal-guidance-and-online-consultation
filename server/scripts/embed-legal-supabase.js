/**
 * Generate embeddings for legal_chunks (requires 003_pgvector.sql).
 * Requires OPENAI_API_KEY or compatible EMBEDDING_API_URL.
 * Usage: npm run embed:legal
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { embedQuery } from '../src/services/embeddings.js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY in server/.env');
  process.exit(1);
}

const sb = createClient(url, key);

const { data: chunks, error } = await sb
  .from('legal_chunks')
  .select('id, content')
  .limit(500);

if (error) {
  console.error(error.message);
  process.exit(1);
}

let done = 0;
for (const row of chunks || []) {
  const vector = await embedQuery(row.content);
  if (!vector) {
    console.error('Embedding API unavailable. Set OPENAI_API_KEY in .env');
    process.exit(1);
  }
  const { error: upErr } = await sb.from('legal_chunks').update({ embedding: vector }).eq('id', row.id);
  if (!upErr) {
    done++;
    if (done % 10 === 0) console.log(`Embedded ${done}…`);
  }
}

console.log(`Done. Embedded ${done} chunk(s).`);
