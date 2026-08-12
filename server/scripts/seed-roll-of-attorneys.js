// ============================================================
// Seed the local SC Roll of Attorneys table from the bundled
// rollOfAttorneysSeed.json. Used by the lawyer-verification
// flow to deterministically cross-check submitted credentials.
//
// Usage:
//   node server/scripts/seed-roll-of-attorneys.js
// ============================================================
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

async function main() {
  const file = path.join(__dirname, '../data/rollOfAttorneysSeed.json');
  if (!fs.existsSync(file)) {
    console.error('Roll of Attorneys seed not found at', file);
    process.exit(1);
  }
  const rows = JSON.parse(fs.readFileSync(file, 'utf-8'));

  let upserts = 0;
  for (const row of rows) {
    await prisma.rollOfAttorneys.upsert({
      where: { rollNumber: row.rollNumber },
      create: {
        rollNumber: row.rollNumber,
        fullName: row.fullName,
        admittedAt: row.admittedAt ? new Date(row.admittedAt) : null,
        region: row.region || null,
        status: row.status || 'ACTIVE',
      },
      update: {
        fullName: row.fullName,
        admittedAt: row.admittedAt ? new Date(row.admittedAt) : null,
        region: row.region || null,
        status: row.status || 'ACTIVE',
      },
    });
    upserts++;
  }
  console.log(`[seed-roll] Upserted ${upserts} roll-of-attorneys entries.`);
}

main()
  .catch((e) => {
    console.error('[seed-roll] failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
