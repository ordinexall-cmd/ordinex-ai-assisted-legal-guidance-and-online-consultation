/**
 * CI smoke test — database + optional HTTP health + env warnings.
 */
import 'dotenv/config';
import { prisma } from '../src/config/prisma.js';
import { env } from '../src/config/env.js';

const count = await prisma.user.count();
console.log(`DB OK — users in DB: ${count}`);

const warnings = [];
if (!env.GROQ_API_KEY) {
  warnings.push('GROQ_API_KEY unset — AI case identification will fail until set');
}
for (const w of warnings) {
  console.warn(`WARN: ${w}`);
}

const healthUrl = process.env.SMOKE_HEALTH_URL || '';
if (healthUrl) {
  const res = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) {
    throw new Error(`Health check failed: HTTP ${res.status} at ${healthUrl}`);
  }
  const body = await res.json();
  if (body.status !== 'ok') {
    throw new Error(`Health check returned unexpected body: ${JSON.stringify(body)}`);
  }
  console.log(`HTTP health OK — ${healthUrl}`);
}

console.log('Smoke OK');
await prisma.$disconnect();
