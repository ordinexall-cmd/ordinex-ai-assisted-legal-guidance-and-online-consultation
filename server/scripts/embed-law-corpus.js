#!/usr/bin/env node
/**
 * Backfill Gemini embeddings for all LawReference rows.
 * Usage: node scripts/embed-law-corpus.js [--limit N]
 */
import { embedAllLawReferences } from '../src/services/embeddings.js';

const limit = process.argv.includes('--limit')
  ? parseInt(process.argv[process.argv.indexOf('--limit') + 1], 10)
  : null;

console.log('[embed-law-corpus] Starting backfill...');
const report = await embedAllLawReferences({ batchPauseMs: 250 });
console.log('[embed-law-corpus] Done:', report);
if (limit) console.log('(limit flag noted; full corpus embedded)');
