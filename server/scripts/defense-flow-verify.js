/**
 * End-to-end defense flow (API): analyze → book with consultationId → lawyer linked-analysis.
 * Requires API running. Usage: node scripts/defense-flow-verify.js [baseUrl]
 */
import 'dotenv/config';
import { DEMO_PASSWORD, DEMO_CITIZEN_EMAIL, DEMO_LAWYER_EMAIL } from '../prisma/demoAccounts.js';

const base = (process.argv[2] || process.env.API_VERIFY_URL || 'http://localhost:5000').replace(/\/$/, '');

const CASE_TEXT =
  'My employer terminated me last month without notice after three years of work in Davao City. I was never given a written explanation or separation pay.';

async function login(email) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: DEMO_PASSWORD,
      role: email === DEMO_LAWYER_EMAIL ? 'LAWYER' : 'CITIZEN',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status !== 200 || !data.token) {
    throw new Error(`Login failed for ${email}: ${data.error || res.status}`);
  }
  return data.token;
}

async function authFetch(path, token, opts = {}) {
  const res = await fetch(`${base}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...opts.headers,
    },
    body: opts.body,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function ok(label, pass, detail = '') {
  console.log(`${pass ? '  OK' : ' FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
  return pass;
}

async function main() {
  console.log(`Defense flow verification against ${base}\n`);
  let allOk = true;

  const citizenToken = await login(DEMO_CITIZEN_EMAIL);
  const lawyerToken = await login(DEMO_LAWYER_EMAIL);

  const analyze = await authFetch('/api/consultation/analyze', citizenToken, {
    method: 'POST',
    body: JSON.stringify({
      category: 'Labor and Employment',
      description: CASE_TEXT,
    }),
  });

  const consultationId = analyze.data?.consultation?.id || analyze.data?.id;
  const outcome = analyze.data?.outcomeType || analyze.data?.consultation?.outcomeType;
  allOk =
    ok(
      'POST /api/consultation/analyze',
      (analyze.status === 200 || analyze.status === 201) && !!consultationId,
      outcome ? `outcome=${outcome}` : '',
    ) && allOk;

  if (!consultationId) {
    console.error('\nCannot continue without consultation id.');
    process.exit(1);
  }

  const lawyers = await authFetch('/api/lawyers', citizenToken);
  const lawyerList = lawyers.data?.lawyers || lawyers.data || [];
  const privateLawyer = Array.isArray(lawyerList)
    ? lawyerList.find((l) => l.practiceType === 'PRIVATE' && (l.consultationFee ?? 0) > 0)
    : null;
  allOk =
    ok('GET /api/lawyers', lawyers.status === 200 && !!privateLawyer?.id) && allOk;

  if (!privateLawyer?.id) {
    process.exit(1);
  }

  const lawyerMe = await authFetch('/api/auth/me', lawyerToken);
  const lawyerUserId = lawyerMe.data?.user?.id || lawyerMe.data?.id;
  if (lawyerUserId && lawyerUserId !== privateLawyer.id) {
    console.warn(
      `  WARN private lawyer differs from ${DEMO_LAWYER_EMAIL} — using booking lawyer for linked-analysis`,
    );
  }

  const slots = await authFetch(`/api/lawyers/${privateLawyer.id}/availability`, citizenToken);
  const slotList = slots.data?.slots || slots.data?.availability || slots.data || [];
  const slot = Array.isArray(slotList) ? slotList.find((s) => !s.isBooked) : null;
  allOk = ok('GET lawyer availability', slots.status === 200 && !!slot?.id) && allOk;

  if (!slot?.id) {
    process.exit(1);
  }

  const book = await authFetch('/api/bookings', citizenToken, {
    method: 'POST',
    body: JSON.stringify({
      availabilityId: slot.id,
      preferredStartTime: slot.openStarts?.[0] || slot.startTime,
      consultationId,
    }),
  });
  const bookingId = book.data?.booking?.id || book.data?.id;
  allOk =
    ok(
      'POST /api/bookings (with consultationId)',
      book.status === 201 && !!bookingId,
      book.data?.booking?.consultationId ? 'linked' : '',
    ) && allOk;

  if (!bookingId) {
    process.exit(1);
  }

  const linked = await authFetch(`/api/bookings/${bookingId}/linked-analysis`, lawyerToken);
  const analysisPayload = linked.data?.analysis;
  const hasAnalysis =
    linked.status === 200 &&
    analysisPayload &&
    (analysisPayload.aiResult ||
      analysisPayload.parsedAiResult ||
      analysisPayload.description);
  allOk = ok('GET /api/bookings/:id/linked-analysis (lawyer)', hasAnalysis) && allOk;

  const preview = await fetch(`${base}/api/consultation/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: CASE_TEXT }),
  });
  const previewData = await preview.json().catch(() => ({}));
  allOk =
    ok(
      'POST /api/consultation/preview (landing)',
      preview.status === 200 && typeof previewData.previewLine === 'string',
    ) && allOk;

  console.log(allOk ? '\nDefense flow OK\n' : '\nDefense flow FAILED\n');
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
