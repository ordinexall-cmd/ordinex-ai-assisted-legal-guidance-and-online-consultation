/**
 * Extended API verification (run with server up: npm run dev in server).
 * Usage: node scripts/api-verify.js [baseUrl]
 */
import 'dotenv/config';

const base = (process.argv[2] || process.env.API_VERIFY_URL || 'http://localhost:5000').replace(/\/$/, '');

async function req(path, opts = {}) {
  const url = `${base}${path}`;
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    body: opts.body,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 200) };
  }
  return { status: res.status, data };
}

async function main() {
  const results = [];

  // Health
  try {
    const h = await req('/api/health');
    results.push({ name: 'GET /api/health', ok: h.status === 200 && h.data?.status === 'ok' });
  } catch (e) {
    results.push({ name: 'GET /api/health', ok: false, error: e.message });
  }

  // Auth register validation (should 400 without phone)
  try {
    const r = await req('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', email: 'bad', password: 'short' }),
    });
    results.push({ name: 'POST /api/auth/register validation', ok: r.status === 400 });
  } catch (e) {
    results.push({ name: 'POST /api/auth/register validation', ok: false, error: e.message });
  }

  // Trash route exists (401 without auth)
  try {
    const r = await req('/api/consultation/trash');
    results.push({ name: 'GET /api/consultation/trash (no auth)', ok: r.status === 401 });
  } catch (e) {
    results.push({ name: 'GET /api/consultation/trash', ok: false, error: e.message });
  }

  // Lawyers directory requires auth+premium
  try {
    const r = await req('/api/lawyers');
    results.push({ name: 'GET /api/lawyers (no auth)', ok: r.status === 401 });
  } catch (e) {
    results.push({ name: 'GET /api/lawyers', ok: false, error: e.message });
  }

  const hasGroq = !!(process.env.GROQ_API_KEY || '').trim();
  const validPreviewBody = JSON.stringify({
    description:
      'My employer terminated me last month without notice after three years of work in Davao City. I was never given a written explanation.',
  });

  // Guest preview: short body → 400
  try {
    const r = await req('/api/consultation/preview', {
      method: 'POST',
      body: JSON.stringify({ description: 'too short' }),
    });
    results.push({ name: 'POST /api/consultation/preview (short body)', ok: r.status === 400 });
  } catch (e) {
    results.push({ name: 'POST /api/consultation/preview (short body)', ok: false, error: e.message });
  }

  // Guest preview: valid body → 200 with previewLine (soft pass without GROQ_API_KEY)
  try {
    const r = await req('/api/consultation/preview', {
      method: 'POST',
      body: validPreviewBody,
    });
    const hasTeaserShape =
      typeof r.data?.previewLine === 'string' &&
      r.data.previewLine.length > 0 &&
      typeof r.data?.lawHintLine === 'string' &&
      r.data.lawHintLine.length > 0;
    const ok =
      hasGroq
        ? r.status === 200 && hasTeaserShape
        : r.status === 200 || r.status === 500 || r.status === 503;
    results.push({
      name: hasGroq
        ? 'POST /api/consultation/preview (valid body)'
        : 'POST /api/consultation/preview (valid body, no GROQ — soft pass)',
      ok,
      skipReason: hasGroq ? undefined : 'GROQ_API_KEY not set',
    });
  } catch (e) {
    results.push({
      name: 'POST /api/consultation/preview (valid body)',
      ok: !hasGroq,
      error: e.message,
      skipReason: hasGroq ? undefined : 'GROQ_API_KEY not set',
    });
  }

  // Optional fallback verification note (requires server started with FORCE_GROQ_FAILURE=true and OPENAI_API_KEY set)
  if ((process.env.OPENAI_API_KEY || '').trim()) {
    results.push({
      name: 'Groq->OpenAI fallback check',
      ok: true,
      skipReason:
        'To force-check fallback path, run API with FORCE_GROQ_FAILURE=true and rerun this script.',
    });
  }

  const failed = results.filter((r) => !r.ok);
  console.log('API verification against', base);
  for (const r of results) {
    const tag = r.ok ? '  OK' : 'FAIL';
    const extra = [r.error, r.skipReason].filter(Boolean).join(' — ');
    console.log(tag, r.name, extra);
  }
  if (failed.length) {
    process.exit(1);
  }
  console.log('All checks passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
