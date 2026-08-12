/**
 * Deletes all users and dependent rows so emails/phones can be re-used.
 * Keeps LawReference and RollOfAttorneys seed data. Dev SQLite only by default.
 *
 * Production: requires CONFIRM_CLEAR_ALL_USERS=1
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function confirmed() {
  if (process.env.CONFIRM_CLEAR_ALL_USERS === '1') return true;
  if ((process.env.NODE_ENV || 'development') !== 'production') return true;
  return false;
}

async function main() {
  if (!confirmed()) {
    console.error(
      'Refusing to clear all users in production without CONFIRM_CLEAR_ALL_USERS=1',
    );
    process.exit(1);
  }

  await prisma.$transaction([
    prisma.recordHash.deleteMany(),
    prisma.review.deleteMany(),
    prisma.booking.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.report.deleteMany(),
    prisma.lawyerVerification.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.consultation.deleteMany(),
    prisma.availability.deleteMany(),
    prisma.otpChallenge.deleteMany(),
    prisma.pendingRegistration.deleteMany(),
    prisma.user.deleteMany(),
  ]);
  console.log(
    'All users and related data cleared. LawReference and RollOfAttorneys kept.',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
