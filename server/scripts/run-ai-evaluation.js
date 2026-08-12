/**
 * Run AI evaluation fixtures against analyzeLegalCase (offline corpus + Groq).
 * Usage: node scripts/run-ai-evaluation.js
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeLegalCase } from '../src/services/aiOrchestrator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/aiEvaluationFixtures.json'), 'utf-8'),
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
let failed = 0;

for (let i = 0; i < fixtures.length; i++) {
  const f = fixtures[i];
  if (i > 0) await sleep(12_000);
  try {
    const { result, meta } = await analyzeLegalCase({
      category: f.category,
      description: f.description,
      isPremium: true,
    });

    const cases = result.possibleLegalCases || [];
    const level = result.courtWinOutlook?.level;

    if (f.expectUncertain && level !== 'Uncertain') {
      throw new Error(`expected Uncertain, got ${level}`);
    }
    if (f.minCases != null && cases.length < f.minCases) {
      throw new Error(`expected >= ${f.minCases} cases, got ${cases.length}`);
    }
    if (f.expectKeywords?.length) {
      const blob = JSON.stringify(result).toLowerCase();
      for (const kw of f.expectKeywords) {
        if (!blob.includes(kw.toLowerCase())) {
          throw new Error(`missing keyword: ${kw}`);
        }
      }
    }
    if (f.expectComplexCase === true && !result._complexCase) {
      throw new Error('expected _complexCase true');
    }
    if (f.expectComplexCase === false && result._complexCase) {
      throw new Error('expected _complexCase false');
    }
    if (f.expectWeakOrUncertain) {
      const topConf = cases[0]?.confidenceScore ?? 0;
      const weak =
        result._complexCase
        || level === 'Uncertain'
        || cases.length === 0
        || topConf < 55;
      if (!weak) throw new Error('expected weak/uncertain outcome');
    }

    console.log(`OK  ${f.id} (corpus: ${meta.corpusSource})`);
    passed++;
  } catch (e) {
    console.log(`FAIL ${f.id}: ${e.message}`);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
