/**
 * Reset transactional data for demo + panel accounts, then re-sync demo users and slots.
 * Safe for production: only touches known demo emails; never deletes non-demo users.
 *
 * Usage:
 *   CONFIRM_RESET_DEMO=1 npm run db:reset-demo
 *   node scripts/reset-demo-state.js --yes
 */
import 'dotenv/config';
import { prisma } from '../src/config/prisma.js';
import {
  DEMO_EMAILS,
  DEMO_SEED_VERSION,
  syncDemoAccounts,
  setStoredDemoVersion,
} from '../prisma/demoAccounts.js';
import { seedAvailabilitySlots } from '../prisma/seedAvailability.js';

const PANEL_EMAIL = 'panel-lawyer@ordinex.demo';

const DEMO_PHONES = [
  '09171234567',
  '09181234567',
  '09191234567',
  '09201234567',
  '09178888888',
];

function confirmed() {
  if (process.argv.includes('--yes')) return true;
  return process.env.CONFIRM_RESET_DEMO === '1';
}

async function deleteDemoTransactionalData(userIds) {
  if (userIds.length === 0) {
    return {
      recordHash: 0,
      review: 0,
      booking: 0,
      notification: 0,
      report: 0,
      subscription: 0,
      consultation: 0,
      availability: 0,
      lawyerVerification: 0,
    };
  }

  const bookings = await prisma.booking.findMany({
    where: {
      OR: [
        { citizenId: { in: userIds } },
        { lawyerId: { in: userIds } },
      ],
    },
    select: { id: true },
  });
  const bookingIds = bookings.map((b) => b.id);

  const counts = {};

  if (bookingIds.length > 0) {
    counts.recordHash = (await prisma.recordHash.deleteMany({
      where: { bookingId: { in: bookingIds } },
    })).count;
    counts.review = (await prisma.review.deleteMany({
      where: { bookingId: { in: bookingIds } },
    })).count;
    counts.booking = (await prisma.booking.deleteMany({
      where: { id: { in: bookingIds } },
    })).count;
  } else {
    counts.recordHash = 0;
    counts.review = 0;
    counts.booking = 0;
  }

  counts.notification = (await prisma.notification.deleteMany({
    where: { userId: { in: userIds } },
  })).count;

  counts.report = (await prisma.report.deleteMany({
    where: {
      OR: [
        { reporterId: { in: userIds } },
        { reportedUserId: { in: userIds } },
      ],
    },
  })).count;

  counts.subscription = (await prisma.subscription.deleteMany({
    where: { userId: { in: userIds } },
  })).count;

  counts.consultation = (await prisma.consultation.deleteMany({
    where: { userId: { in: userIds } },
  })).count;

  counts.availability = (await prisma.availability.deleteMany({
    where: { lawyerId: { in: userIds } },
  })).count;

  counts.lawyerVerification = (await prisma.lawyerVerification.deleteMany({
    where: { userId: { in: userIds } },
  })).count;

  return counts;
}

async function clearDemoOtpAndPending() {
  const otp = (await prisma.otpChallenge.deleteMany({
    where: { phone: { in: DEMO_PHONES } },
  })).count;
  const pending = (await prisma.pendingRegistration.deleteMany({
    where: { phone: { in: DEMO_PHONES } },
  })).count;
  return { otp, pending };
}

async function deletePanelUser() {
  const user = await prisma.user.findUnique({ where: { email: PANEL_EMAIL } });
  if (!user) return false;
  await prisma.lawyerVerification.deleteMany({ where: { userId: user.id } });
  await deleteDemoTransactionalData([user.id]);
  await prisma.user.delete({ where: { id: user.id } });
  return true;
}

async function main() {
  if (!confirmed()) {
    console.error(
      'Refusing to run without confirmation. Set CONFIRM_RESET_DEMO=1 or pass --yes.',
    );
    process.exit(1);
  }

  const resetEmails = [...DEMO_EMAILS, PANEL_EMAIL];
  const users = await prisma.user.findMany({
    where: { email: { in: resetEmails } },
    select: { id: true, email: true },
  });
  const demoUserIds = users
    .filter((u) => DEMO_EMAILS.includes(u.email))
    .map((u) => u.id);

  console.log('🔄 Resetting demo account state...\n');
  console.log(`   Demo users found: ${demoUserIds.length} / ${DEMO_EMAILS.length}`);

  const deleted = await deleteDemoTransactionalData(demoUserIds);
  console.log('   Cleared transactional data:', deleted);

  const otpCleared = await clearDemoOtpAndPending();
  console.log('   Cleared OTP/pending:', otpCleared);

  const panelRemoved = await deletePanelUser();
  if (panelRemoved) {
    console.log(`   Removed panel user ${PANEL_EMAIL}`);
  }

  console.log('\n👤 Syncing demo accounts...');
  const { lawyer, publicLawyer } = await syncDemoAccounts(prisma, {
    log: (msg) => console.log(`   ✅ ${msg}`),
    resetPasswords: true,
  });
  await setStoredDemoVersion(prisma, DEMO_SEED_VERSION);

  console.log('\n📅 Seeding availability slots...');
  const { lawyerSlots, publicSlots } = await seedAvailabilitySlots(
    prisma,
    lawyer.id,
    publicLawyer.id,
  );
  console.log(`   ✅ ${lawyerSlots} slots for lawyer@test.com`);
  console.log(`   ✅ ${publicSlots} slots for publiclawyer@test.com`);

  console.log('\n✅ Demo state reset complete (password: password123)');
  console.log('   Panel walkthrough: clear done — use /lawyer/register?panel=1');
}

main()
  .catch((e) => {
    console.error('❌ reset-demo-state failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
