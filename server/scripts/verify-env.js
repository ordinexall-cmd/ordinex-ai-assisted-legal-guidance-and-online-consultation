/**
 * Verify Ordinex environment (no secrets printed).
 * Run: node scripts/verify-env.js
 */
import 'dotenv/config';

const checks = [];
const isProd = process.env.NODE_ENV === 'production';

function ok(label, pass, detail = '') {
  checks.push({ label, pass, detail });
}

// --- AI providers (Groq primary, Gemini fallback) ---
ok('GROQ_API_KEY', !!process.env.GROQ_API_KEY, process.env.GROQ_API_KEY ? 'set' : 'required for case identification');
ok('GEMINI_API_KEY', !!process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY ? 'fallback configured' : 'optional fallback');

if (process.env.GROQ_API_KEY) {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: 'Reply OK' }],
        max_tokens: 5,
        include_reasoning: false,
      }),
    });
    const body = await res.json().catch(() => ({}));
    ok('Groq API', res.ok, res.ok ? 'reachable' : (body.error?.message || res.status));
  } catch (e) {
    ok('Groq API', false, e.message);
  }
}

// --- Database ---
ok('DATABASE_URL', !!process.env.DATABASE_URL, process.env.DATABASE_URL ? 'set' : 'required');
if (isProd) {
  ok('DATABASE_URL is postgres', (process.env.DATABASE_URL || '').startsWith('postgres'));
  ok('DIRECT_URL', !!process.env.DIRECT_URL, 'used by prisma migrate/generate');
}

// --- Production-only hard requirements ---
if (isProd) {
  const secret = process.env.JWT_SECRET || '';
  const weak = ['ordinex-dev-secret-key-2026', 'ordinex-dev-secret-key-2026-change-in-production'];
  ok('JWT_SECRET strong', !!secret && secret.length >= 32 && !weak.includes(secret),
    secret ? '' : 'set a random value of at least 32 characters');

  ok('FRONTEND_URL https', /^https:\/\//.test(process.env.FRONTEND_URL || ''),
    'production frontend must be served over HTTPS');

  const mode = (process.env.PAYMENTS_MODE || '').toLowerCase();
  ok('PAYMENTS_MODE set', ['simulated', 'paymongo'].includes(mode), mode || 'must be simulated or paymongo');
  if (mode === 'paymongo') {
    ok('PAYMONGO keys', !!process.env.PAYMONGO_SECRET_KEY && !!process.env.PAYMONGO_PUBLIC_KEY);
    ok('PAYMONGO_WEBHOOK_SECRET', !!process.env.PAYMONGO_WEBHOOK_SECRET, 'required to verify webhooks');
  }
}

console.log('\nOrdinex environment check\n');
for (const c of checks) {
  console.log(`${c.pass ? 'OK' : '!!'} ${c.label}${c.detail ? ` — ${c.detail}` : ''}`);
}
const failed = checks.filter((c) => !c.pass);
console.log(`\n${failed.length ? `${failed.length} check(s) failed.` : 'All checks passed.'}\n`);
process.exit(failed.length ? 1 : 0);
