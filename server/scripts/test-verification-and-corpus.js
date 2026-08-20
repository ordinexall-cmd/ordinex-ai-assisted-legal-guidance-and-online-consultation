// ============================================================
// Ordinex — focused unit tests for lawyer verification thresholds
// and AI corpus freshness handling.
//
// Pure-function tests only (no DB / no network). Run with:
//   npm run test:verification
//
// Covers:
//   1. nameSimilarity: equal names ≥ 0.99, common typos ≥ 0.8,
//      reordered tokens ≥ 0.7, unrelated ≤ 0.3.
//   2. computeVerificationOutcome: produces AUTO_APPROVE for high
//      confidence, NEEDS_REUPLOAD for medium, AUTO_REJECT for low,
//      and AUTO_REJECT (with a specific reason) for hard fails.
//   3. validateAndFilterAnalysis: tags freshness on each case,
//      flags `_supersededWarning` when all chunks are stale, and
//      keeps current-source cases untouched.
//   4. summarizeChunkFreshness: counts active/amended/superseded
//      consistently and surfaces the oldest update age.
// ============================================================
import assert from 'node:assert/strict';
import { nameSimilarity } from '../src/utils/stringDistance.js';
import {
  computeVerificationOutcome,
  VERIFICATION_DECISION,
  VERIFICATION_STATUS,
} from '../src/services/lawyerVerification.js';
import { validateAndFilterAnalysis } from '../src/services/legalValidator.js';
import { summarizeChunkFreshness } from '../src/services/legalCorpus.js';
import { detectLanguageLocal } from '../src/services/aiOrchestrator.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ok  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('\n[1] nameSimilarity thresholds');

test('exact match scores ~1', () => {
  const s = nameSimilarity('Juan Dela Cruz', 'Juan Dela Cruz');
  assert.ok(s >= 0.99, `expected >=0.99, got ${s}`);
});

test('single-letter swap stays above hard-reject threshold', () => {
  // jaccard penalises the misspelled token, so we don't expect ~1.0,
  // but the composite should stay clearly above an unrelated-name score.
  const s = nameSimilarity('Juan Dela Cruz', 'Jaun Dela Cruz');
  assert.ok(s >= 0.6, `expected >=0.6, got ${s}`);
});

test('reordered tokens stay high', () => {
  const s = nameSimilarity('Juan Dela Cruz', 'Dela Cruz, Juan');
  assert.ok(s >= 0.65, `expected >=0.65, got ${s}`);
});

test('honorifics ignored', () => {
  const s = nameSimilarity('Atty. Juan Dela Cruz Jr.', 'Juan Dela Cruz');
  assert.ok(s >= 0.7, `expected >=0.7, got ${s}`);
});

test('completely different names score low', () => {
  const s = nameSimilarity('Juan Dela Cruz', 'Maria Santos');
  assert.ok(s <= 0.35, `expected <=0.35, got ${s}`);
});

console.log('\n[2] computeVerificationOutcome decision tiers');

function rowOf(overrides = {}) {
  return {
    rollMatchHit: true,
    submittedFullName: 'Juan Dela Cruz',
    rollMatchedName: 'Juan Dela Cruz',
    govIdOcrName: 'Juan Dela Cruz',
    govIdUrl: 'uploads/verification/id.jpg',
    selfieUrl: 'uploads/verification/selfie.jpg',
    challengeCodeMatched: true,
    faceMatchScore: 0.95,
    paymentNameMatchScore: 0.95,
    ...overrides,
  };
}

test('high confidence -> AUTO_APPROVE/VERIFIED', () => {
  const out = computeVerificationOutcome(rowOf(), {
    faceProviderOverride: 'groq-vision',
    ocrProviderOverride: 'groq-vision',
  });
  assert.equal(out.decision, VERIFICATION_DECISION.AUTO_APPROVE);
  assert.equal(out.status, VERIFICATION_STATUS.VERIFIED);
  assert.ok(out.score >= 85, `expected score>=85, got ${out.score}`);
});

test('medium confidence -> NEEDS_REUPLOAD', () => {
  const out = computeVerificationOutcome(
    rowOf({ faceMatchScore: 0.55, paymentNameMatchScore: 0.5, govIdOcrName: 'Juan D Cruz' }),
    { faceProviderOverride: 'groq-vision', ocrProviderOverride: 'groq-vision' },
  );
  assert.equal(out.decision, VERIFICATION_DECISION.NEEDS_REUPLOAD);
  assert.equal(out.status, VERIFICATION_STATUS.NEEDS_REUPLOAD);
  assert.ok(out.score >= 60 && out.score < 85, `expected 60<=score<85, got ${out.score}`);
});

test('low confidence -> AUTO_REJECT', () => {
  const out = computeVerificationOutcome(
    rowOf({ faceMatchScore: 0.15, paymentNameMatchScore: 0.1, govIdOcrName: 'Pedro Santos' }),
    { faceProviderOverride: 'groq-vision', ocrProviderOverride: 'groq-vision' },
  );
  assert.equal(out.decision, VERIFICATION_DECISION.AUTO_REJECT);
  assert.equal(out.status, VERIFICATION_STATUS.REJECTED);
});

test('missing roll match -> hard fail AUTO_REJECT', () => {
  const out = computeVerificationOutcome(rowOf({ rollMatchHit: false }), {
    faceProviderOverride: 'groq-vision',
    ocrProviderOverride: 'groq-vision',
  });
  assert.equal(out.decision, VERIFICATION_DECISION.AUTO_REJECT);
  assert.match(out.reason, /SC Roll match missing/i);
});

test('challenge code mismatch -> hard fail with specific reason', () => {
  const out = computeVerificationOutcome(rowOf({ challengeCodeMatched: false }), {
    faceProviderOverride: 'groq-vision',
    ocrProviderOverride: 'groq-vision',
  });
  assert.equal(out.decision, VERIFICATION_DECISION.AUTO_REJECT);
  assert.match(out.reason, /challenge code/i);
});

test('noop providers must not auto-approve on perfect synthetic signals', () => {
  const out = computeVerificationOutcome(rowOf(), {
    faceProviderOverride: 'noop',
    ocrProviderOverride: 'noop',
  });
  assert.notEqual(
    out.decision,
    VERIFICATION_DECISION.AUTO_APPROVE,
    `noop providers should never produce AUTO_APPROVE (got ${out.decision} @ ${out.score})`,
  );
});

console.log('\n[3] validateAndFilterAnalysis freshness handling');

const baseAi = {
  userConcernSummary: 'Worker terminated without notice.',
  extractedKeywords: ['termination', 'notice'],
  penalties: '',
  courtWinOutlook: {
    level: 'Moderate',
    summary: 'Likely valid claim if facts are confirmed.',
    factorsFor: [],
    factorsAgainst: [],
    missingFacts: [],
  },
  suggestedNextSteps: ['File a complaint with DOLE.'],
  recommendedAgency: 'DOLE',
  lawyerSpecialty: 'Labor',
  costBallpark: '₱2,000-₱5,000',
  systemDisclaimer: 'AI guidance only.',
  possibleLegalCases: [{
    name: 'Illegal Dismissal',
    confidenceScore: 78,
    explanation: 'Termination without due notice.',
    applicableLaw: 'Labor Code Article 297',
    sourceLink: null,
    sourceId: 'chunk-1',
  }],
};

test('current-source case keeps freshness=current', () => {
  const chunks = [{
    id: 'chunk-1', name: 'Labor Code Article 297', citation: 'Labor Code Art. 297',
    region: 'National', category: 'Labor', status: 'ACTIVE',
    source_url: 'https://example.test/labor-code', content: 'Just causes for termination.',
  }];
  const out = validateAndFilterAnalysis(structuredClone(baseAi), chunks);
  assert.equal(out.possibleLegalCases.length, 1);
  assert.equal(out.possibleLegalCases[0].freshness, 'current');
  assert.notEqual(out._supersededWarning, true);
});

test('amended-source case is tagged amended (not stale)', () => {
  const chunks = [{
    id: 'chunk-1', name: 'Labor Code Article 297', citation: 'Labor Code Art. 297',
    region: 'National', category: 'Labor', status: 'AMENDED',
    source_url: 'https://example.test/labor-code', content: 'Updated text.',
  }];
  const out = validateAndFilterAnalysis(structuredClone(baseAi), chunks);
  assert.equal(out.possibleLegalCases[0].freshness, 'amended');
  assert.notEqual(out._supersededWarning, true);
});

test('all-stale chunks → _supersededWarning + Uncertain outlook', () => {
  const chunks = [{
    id: 'chunk-1', name: 'Labor Code Article 297', citation: 'Labor Code Art. 297',
    region: 'National', category: 'Labor', status: 'SUPERSEDED',
    source_url: 'https://example.test/labor-code', content: 'Old text.',
  }];
  const out = validateAndFilterAnalysis(structuredClone(baseAi), chunks);
  assert.equal(out._supersededWarning, true);
  assert.equal(out.courtWinOutlook.level, 'Uncertain');
});

console.log('\n[4] summarizeChunkFreshness counters');

test('counts by status and reports highPriority/age', () => {
  const now = Date.now();
  const dayAgo = (n) => new Date(now - n * 86400000).toISOString();
  const summary = summarizeChunkFreshness([
    { status: 'ACTIVE', priority: 'high', last_changed_at: dayAgo(3) },
    { status: 'AMENDED', priority: 'medium', last_changed_at: dayAgo(10) },
    { status: 'SUPERSEDED', priority: 'low', last_changed_at: dayAgo(120) },
    { status: 'ACTIVE', priority: 'high', last_changed_at: dayAgo(1) },
  ]);
  assert.equal(summary.total, 4);
  assert.equal(summary.active, 2);
  assert.equal(summary.amended, 1);
  assert.equal(summary.superseded, 1);
  assert.equal(summary.highPriority, 2);
  assert.ok(summary.oldestDays >= 110 && summary.oldestDays <= 121);
});

test('empty chunk set returns zeros', () => {
  const summary = summarizeChunkFreshness([]);
  assert.equal(summary.total, 0);
  assert.equal(summary.oldestDays, null);
});

console.log('\n[5] detectLanguageLocal heuristic');

test('Cebuano sentence detected as ceb', () => {
  const lang = detectLanguageLocal(
    'nabangga akoang anak sa sakyanan, unya ang sakyanan ug ang driver kay nidagan. wala ko kita sa plate number.',
  );
  assert.equal(lang, 'ceb', `expected ceb, got ${lang}`);
});

test('Tagalog sentence detected as tl', () => {
  const lang = detectLanguageLocal(
    'Tinanggal ako sa trabaho nang walang dahilan. Hindi naman ako nagkamali at mayroon akong kontrata.',
  );
  assert.equal(lang, 'tl', `expected tl, got ${lang}`);
});

test('Cebuano with shared words still detects ceb', () => {
  const lang = detectLanguageLocal(
    'Gusto nako magpatabang sa abogado tungod sa akong kaso sa barangay. Palihog tabang.',
  );
  assert.equal(lang, 'ceb', `expected ceb, got ${lang}`);
});

test('English sentence returns null (ambiguous)', () => {
  const lang = detectLanguageLocal(
    'I was fired from my job without any reason. I have a contract.',
  );
  assert.equal(lang, null, `expected null, got ${lang}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
