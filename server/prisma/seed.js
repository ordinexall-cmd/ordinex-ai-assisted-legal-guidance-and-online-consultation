// ============================================================
// Ordinex — Database Seed Script
// Full dev reset: laws + demo users + availability slots.
// Demo users alone: npm run db:sync-demo (or auto on API start).
// ============================================================
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { prisma } from '../src/config/prisma.js';
import { syncDemoAccounts, setStoredDemoVersion, DEMO_SEED_VERSION } from './demoAccounts.js';
import { seedAvailabilitySlots } from './seedAvailability.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('🌱 Seeding database...\n');

  console.log('📚 Seeding Philippine law references...');
  const lawsData = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'phLaws.json'), 'utf-8'),
  );
  let extendedLaws = [];
  try {
    extendedLaws = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'phLawsExtended.json'), 'utf-8'),
    );
  } catch {
    extendedLaws = [];
  }
  // De-dup by name; the extended pack is treated as supplementary high-priority
  // concerns layered on top of the base curated dataset.
  const seen = new Set(lawsData.map((l) => l.name));
  const merged = [
    ...lawsData,
    ...extendedLaws.filter((l) => !seen.has(l.name)),
  ];
  await prisma.lawReference.deleteMany();
  for (const law of merged) {
    await prisma.lawReference.create({
      data: {
        category: law.category,
        name: law.name,
        fullText: law.fullText,
        link: law.link || null,
        keywords: law.keywords || '',
        priority: law.priority || 'medium',
        region: law.region || 'National',
        corpusStatus: law.corpusStatus || 'ACTIVE',
        guidanceJson: JSON.stringify({
          suggestedNextSteps: law.suggestedNextSteps || [],
          documentsNeeded: law.documentsNeeded || [],
          cautions: law.cautions || [],
          recommendedAgency: law.recommendedAgency || '',
        }),
      },
    });
  }
  console.log(`   ✅ ${merged.length} law references seeded (base ${lawsData.length} + extended ${merged.length - lawsData.length}).\n`);

  console.log('⚖️  Seeding Roll of Attorneys (lawyer verification)...');
  try {
    const rollData = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../data/rollOfAttorneysSeed.json'), 'utf-8'),
    );
    for (const row of rollData) {
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
    }
    console.log(`   ✅ ${rollData.length} roll-of-attorneys entries seeded.\n`);
  } catch (rollErr) {
    console.warn(`   ⚠️  Roll of Attorneys seed skipped: ${rollErr.message}\n`);
  }

  console.log('👤 Seeding demo accounts...');
  const { lawyer } = await syncDemoAccounts(prisma, {
    log: (msg) => console.log(`   ✅ ${msg}`),
    resetPasswords: true,
  });
  await setStoredDemoVersion(prisma, DEMO_SEED_VERSION);

  console.log('\n📅 Seeding availability slots...');
  let lawyerSlots = 0;
  try {
    ({ lawyerSlots } = await seedAvailabilitySlots(prisma, lawyer.id));
  } catch (slotErr) {
    console.warn('\n⚠️  Demo accounts were created, but availability seeding failed.');
    console.warn(`   Reason: ${slotErr.message}`);
    console.warn('   This is non-critical — demo accounts still work.\n');
  }
  if (lawyerSlots) console.log(`   ✅ ${lawyerSlots} slots for lawyer@ordinex.test\n`);

  console.log('═══════════════════════════════════════');
  console.log('🎉 Database seeded successfully!');
  console.log('═══════════════════════════════════════');
  console.log('\nTest accounts (all use password: password123):');
  console.log('  Citizen (Free Account): citizen@ordinex.test');
  console.log('  Lawyer (Verified):      lawyer@ordinex.test');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
