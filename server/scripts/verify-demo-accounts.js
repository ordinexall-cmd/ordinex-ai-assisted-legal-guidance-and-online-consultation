/**
 * Verify demo accounts can log in and return expected roles/tiers.
 * Requires API running: npm run dev (server) then node scripts/verify-demo-accounts.js
 */
import 'dotenv/config';
import { DEMO_EMAILS, DEMO_PASSWORD, DEMO_CITIZEN_EMAIL, DEMO_LAWYER_EMAIL } from '../prisma/demoAccounts.js';

const base = (process.argv[2] || process.env.API_VERIFY_URL || 'http://localhost:5000').replace(
  /\/$/,
  '',
);

async function login(email) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: DEMO_PASSWORD }),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function me(token) {
  const res = await fetch(`${base}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function lawyers(token) {
  const res = await fetch(`${base}/api/lawyers`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function availability(token) {
  const res = await fetch(`${base}/api/availability/my`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const expectations = {
  [DEMO_CITIZEN_EMAIL]: { role: 'CITIZEN', isPremium: false },
  [DEMO_LAWYER_EMAIL]: { role: 'LAWYER', isVerified: true, practiceType: 'PRIVATE' },
};

async function main() {
  const results = [];

  for (const email of DEMO_EMAILS) {
    const loginRes = await login(email);
    const okLogin = loginRes.status === 200 && loginRes.data?.token;
    results.push({
      name: `login ${email}`,
      ok: okLogin,
      detail: okLogin ? '' : JSON.stringify(loginRes.data),
    });
    if (!okLogin) continue;

    const meRes = await me(loginRes.data.token);
    const user = meRes.data?.user ?? meRes.data;
    const exp = expectations[email];
    const okMe =
      meRes.status === 200 &&
      user?.role === exp.role &&
      (exp.isPremium === undefined || user?.isPremium === exp.isPremium) &&
      (exp.isVerified === undefined || user?.isVerified === exp.isVerified) &&
      (exp.practiceType === undefined || user?.practiceType === exp.practiceType);
    results.push({ name: `me ${email}`, ok: okMe, detail: user?.role });

    if (email === DEMO_CITIZEN_EMAIL) {
      const lawRes = await lawyers(loginRes.data.token);
      results.push({
        name: 'citizen GET /api/lawyers',
        ok: lawRes.status === 200 && Array.isArray(lawRes.data?.lawyers),
      });
    }

    if (email === DEMO_LAWYER_EMAIL) {
      const avRes = await availability(loginRes.data.token);
      const slots = avRes.data?.slots;
      results.push({
        name: `availability ${email}`,
        ok: avRes.status === 200 && Array.isArray(slots) && slots.length > 0,
        detail: Array.isArray(slots) ? `${slots.length} slots` : '',
      });
    }
  }

  console.log('Demo account verification against', base);
  let failed = 0;
  for (const r of results) {
    if (r.ok) console.log('  OK', r.name, r.detail || '');
    else {
      console.log('FAIL', r.name, r.detail || '');
      failed++;
    }
  }
  if (failed) process.exit(1);
  console.log('All demo account checks passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
