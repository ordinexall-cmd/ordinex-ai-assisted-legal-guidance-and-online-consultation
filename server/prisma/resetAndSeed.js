// ============================================================
// Ordinex — Reset & Seed Script
// Purges test/user-created accounts and seeds pristine demo accounts.
// ============================================================
import { prisma } from '../src/config/prisma.js';
import { syncDemoAccounts, DEMO_EMAILS } from './demoAccounts.js';
import { seedAvailabilitySlots } from './seedAvailability.js';

async function resetAndSeed() {
  console.log('🧹 Purging user-created test accounts...\n');

  // Find all non-demo user IDs
  const nonDemoUsers = await prisma.user.findMany({
    where: {
      email: { notIn: DEMO_EMAILS },
    },
    select: { id: true, email: true, name: true },
  });

  console.log(`Found ${nonDemoUsers.length} non-demo account(s) to remove:`);
  for (const u of nonDemoUsers) {
    console.log(` - Removing: ${u.email} (${u.name})`);
  }

  if (nonDemoUsers.length > 0) {
    const nonDemoIds = nonDemoUsers.map((u) => u.id);
    await prisma.consultation.deleteMany({ where: { userId: { in: nonDemoIds } } });
    await prisma.review.deleteMany({ where: { citizenId: { in: nonDemoIds } } });
    await prisma.notification.deleteMany({ where: { userId: { in: nonDemoIds } } });
    await prisma.payment.deleteMany({ where: { userId: { in: nonDemoIds } } });
    await prisma.payoutRequest.deleteMany({ where: { lawyerId: { in: nonDemoIds } } });
    await prisma.report.deleteMany({
      where: {
        OR: [
          { reporterId: { in: nonDemoIds } },
          { reportedUserId: { in: nonDemoIds } },
        ],
      },
    });
    await prisma.booking.deleteMany({
      where: {
        OR: [
          { citizenId: { in: nonDemoIds } },
          { lawyerId: { in: nonDemoIds } },
        ],
      },
    });
    await prisma.availability.deleteMany({ where: { lawyerId: { in: nonDemoIds } } });
    await prisma.lawyerVerification.deleteMany({ where: { userId: { in: nonDemoIds } } });
    await prisma.subscription.deleteMany({ where: { userId: { in: nonDemoIds } } });
    await prisma.user.deleteMany({ where: { id: { in: nonDemoIds } } });
    console.log('   ✅ Non-demo accounts deleted.\n');
  }

  console.log('🌱 Seeding fresh demo accounts...');
  const { lawyer } = await syncDemoAccounts(prisma, {
    log: (msg) => console.log(`   ✅ ${msg}`),
    resetPasswords: true,
  });

  console.log('\n📅 Seeding fresh availability slots...');
  try {
    const { lawyerSlots } = await seedAvailabilitySlots(prisma, lawyer.id);
    console.log(`   ✅ ${lawyerSlots} slots for ${lawyer.email}`);
  } catch (err) {
    console.warn(`   ⚠️ Slot seeding notice: ${err.message}`);
  }

  console.log('\n✨ Database reset and seed completed successfully!');
  process.exit(0);
}

resetAndSeed().catch((err) => {
  console.error('❌ Reset failed:', err);
  process.exit(1);
});
