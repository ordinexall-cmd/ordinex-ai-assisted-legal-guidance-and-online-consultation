/**
 * Verify Ordinex AI environment (no secrets printed).
 * Run: node scripts/verify-env.js
 */
import 'dotenv/config';

const checks = [];

function ok(label, pass, detail = '') {
  checks.push({ label, pass, detail });
}

ok('GROQ_API_KEY', !!process.env.GROQ_API_KEY);
ok('OPENAI_API_KEY', !!process.env.OPENAI_API_KEY, process.env.OPENAI_API_KEY ? 'fallback configured' : 'optional fallback');
ok('SUPABASE_URL', !!process.env.SUPABASE_URL);
ok('SUPABASE_SERVICE_KEY', !!process.env.SUPABASE_SERVICE_KEY);

if (process.env.GROQ_API_KEY) {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: 'Reply OK' }],
        max_tokens: 5,
      }),
    });
    const body = await res.json();
    ok('Groq API', res.ok, res.ok ? 'reachable' : (body.error?.message || res.status));
  } catch (e) {
    ok('Groq API', false, e.message);
  }
}

if (process.env.OPENAI_API_KEY) {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Reply OK' }],
        max_tokens: 5,
      }),
    });
    const body = await res.json();
    ok('OpenAI API', res.ok, res.ok ? 'fallback reachable' : (body.error?.message || res.status));
  } catch (e) {
    ok('OpenAI API', false, e.message);
  }
}

if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const { error } = await sb.from('legal_sources').select('id').limit(1);
    if (error && error.code === 'PGRST205') {
      ok('Supabase legal_sources', false, 'table missing — run supabase/migrations/001_legal_corpus.sql then seed');
    } else if (error) {
      ok('Supabase', false, error.message);
    } else {
      ok('Supabase legal_sources', true, 'reachable');
    }
  } catch (e) {
    ok('Supabase', false, e.message);
  }
}

if (process.env.NODE_ENV === 'production') {
  ok('JWT_SECRET set', !!process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16);
  ok('DATABASE_URL postgres', (process.env.DATABASE_URL || '').startsWith('postgresql'));
}

console.log('\nOrdinex environment check\n');
for (const c of checks) {
  console.log(`${c.pass ? 'OK' : '!!'} ${c.label}${c.detail ? ` — ${c.detail}` : ''}`);
}
const failed = checks.filter((c) => !c.pass && c.label !== 'OpenAI API');
process.exit(failed.length ? 1 : 0);
