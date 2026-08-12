// ============================================================
// Ordinex — Demo account sync (idempotent)
// Bump DEMO_SEED_VERSION when demo tier/rules change in the app.
// ============================================================
import bcrypt from 'bcryptjs';

/** Increment when demo account fields or tier rules change. */
export const DEMO_SEED_VERSION = '3';

export const DEMO_META_KEY = 'demo_seed_version';

export const DEMO_PASSWORD = 'password123';

/** Empty by default — set SYNC_DEMO_ACCOUNTS=true to re-enable seed users. */
export const DEMO_EMAILS = [];

export function isDemoEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return DEMO_EMAILS.includes(email.trim().toLowerCase());
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const sampleCredential = (title) => ([{
  id: `seed-${title.toLowerCase().replace(/\s+/g, '-')}`,
  title,
  description: 'Sample credential for demo seed.',
  fileUrl: '/uploads/credentials/sample-placeholder.pdf',
  uploadedAt: new Date().toISOString(),
}]);

const DEMO_PAYMENT_METHODS = JSON.stringify([
  {
    id: 'demo-pm-ewallet',
    type: 'ewallet',
    provider: 'GCash',
    qrUrl: '/uploads/payments/demo-gcash-qr.png',
    accountName: 'Atty. Sarah Mitchell',
    accountNumber: '09171234567',
  },
  {
    id: 'demo-pm-bank',
    type: 'bank',
    bankName: 'BPI',
    accountName: 'Atty. Sarah Mitchell',
    accountNumber: '1234567890',
  },
]);

/**
 * Upsert the four demo users and premium subscription.
 * Does not touch law references, availability, or non-demo users.
 */
export async function syncDemoAccounts(prisma, opts = {}) {
  const log = opts.log ?? (() => {});
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const citizen = await prisma.user.upsert({
    where: { email: 'citizen@test.com' },
    update: { isPremium: false, trialsUsed: 0, role: 'CITIZEN' },
    create: {
      email: 'citizen@test.com',
      phone: '09171234567',
      passwordHash,
      role: 'CITIZEN',
      name: 'Juan Dela Cruz',
      trialsUsed: 0,
      isFirstLogin: false,
    },
  });
  await prisma.subscription.deleteMany({ where: { userId: citizen.id } });
  log('citizen@test.com (FREE)');

  const premiumEnd = new Date(Date.now() + THIRTY_DAYS_MS);
  const premiumCitizen = await prisma.user.upsert({
    where: { email: 'premium@test.com' },
    update: { isPremium: true, trialsUsed: 0, role: 'CITIZEN' },
    create: {
      email: 'premium@test.com',
      phone: '09181234567',
      passwordHash,
      role: 'CITIZEN',
      name: 'Maria Santos',
      isPremium: true,
      trialsUsed: 0,
      isFirstLogin: false,
    },
  });
  await prisma.subscription.upsert({
    where: { userId: premiumCitizen.id },
    update: {
      status: 'ACTIVE',
      price: 299,
      startDate: new Date(),
      endDate: premiumEnd,
    },
    create: {
      userId: premiumCitizen.id,
      price: 299,
      status: 'ACTIVE',
      reference: 'TEST-REF-001',
      startDate: new Date(),
      endDate: premiumEnd,
    },
  });
  log('premium@test.com (PREMIUM)');

  const privateCreds = JSON.stringify(sampleCredential('Bar Certificate'));
  const demoRoll = '99001';
  await prisma.rollOfAttorneys.upsert({
    where: { rollNumber: demoRoll },
    create: {
      rollNumber: demoRoll,
      fullName: 'Sarah Mitchell',
      admittedAt: new Date('2014-04-19'),
      region: 'NCR',
      status: 'ACTIVE',
    },
    update: {
      fullName: 'Sarah Mitchell',
      status: 'ACTIVE',
      region: 'NCR',
    },
  });

  const lawyer = await prisma.user.upsert({
    where: { email: 'lawyer@test.com' },
    update: {
      credentials: privateCreds,
      isVerified: true,
      lawyerVerificationStatus: 'VERIFIED',
      lawyerVerificationScore: 100,
      lawyerVerificationUpdatedAt: new Date(),
      paymentMethods: DEMO_PAYMENT_METHODS,
      consultationFee: 1500,
      practiceType: 'PRIVATE',
      specializations: JSON.stringify(['Criminal', 'Family']),
      barNumber: demoRoll,
      acceptingBookings: true,
    },
    create: {
      email: 'lawyer@test.com',
      phone: '09191234567',
      passwordHash,
      role: 'LAWYER',
      name: 'Atty. Sarah Mitchell',
      barNumber: demoRoll,
      specializations: JSON.stringify(['Criminal', 'Family']),
      consultationFee: 1500,
      bio: 'Experienced criminal and family law attorney with 10+ years of practice in Metro Manila.',
      yearsOfExperience: 10,
      practiceType: 'PRIVATE',
      isVerified: true,
      lawyerVerificationStatus: 'VERIFIED',
      lawyerVerificationScore: 100,
      lawyerVerificationUpdatedAt: new Date(),
      credentials: privateCreds,
      paymentMethods: DEMO_PAYMENT_METHODS,
      rating: 4.8,
      ratingCount: 24,
      isFirstLogin: false,
      acceptingBookings: true,
    },
  });

  await prisma.lawyerVerification.upsert({
    where: { userId: lawyer.id },
    create: {
      userId: lawyer.id,
      submittedFullName: 'Sarah Mitchell',
      submittedRollNumber: demoRoll,
      rollMatchedName: 'Sarah Mitchell',
      rollMatchHit: true,
      decision: 'AUTO_APPROVE',
      decisionReason: 'Demo seed — pre-verified for local development.',
      decisionAt: new Date(),
      aggregateConfidence: 100,
      attempts: 1,
      lastSubmittedAt: new Date(),
    },
    update: {
      submittedFullName: 'Sarah Mitchell',
      submittedRollNumber: demoRoll,
      rollMatchedName: 'Sarah Mitchell',
      rollMatchHit: true,
      decision: 'AUTO_APPROVE',
      decisionReason: 'Demo seed — pre-verified for local development.',
      decisionAt: new Date(),
      aggregateConfidence: 100,
    },
  });
  log('lawyer@test.com (VERIFIED)');

  // Convert legacy public demo lawyer to private verified counsel if present
  const publicLawyer = await prisma.user.findUnique({ where: { email: 'publiclawyer@test.com' } });
  if (publicLawyer) {
    await prisma.user.update({
      where: { id: publicLawyer.id },
      data: {
        practiceType: 'PRIVATE',
        consultationFee: 800,
        consultationFeeMin: 500,
        consultationFeeMax: 1500,
        bio: 'Private attorney focused on labor and consumer matters.',
        isVerified: true,
        lawyerVerificationStatus: 'VERIFIED',
        specializations: JSON.stringify(['Labor', 'Consumer']),
        acceptingBookings: true,
      },
    });
  }

  if (opts.resetPasswords) {
    await prisma.user.updateMany({
      where: {
        email: { in: DEMO_EMAILS },
      },
      data: { passwordHash },
    });
    log('passwords reset to password123');
  }

  return { citizen, premiumCitizen, lawyer, publicLawyer, version: DEMO_SEED_VERSION };
}

export async function getStoredDemoVersion(prisma) {
  try {
    const row = await prisma.appMeta.findUnique({ where: { key: DEMO_META_KEY } });
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function setStoredDemoVersion(prisma, version) {
  await prisma.appMeta.upsert({
    where: { key: DEMO_META_KEY },
    update: { value: version },
    create: { key: DEMO_META_KEY, value: version },
  });
}

/**
 * Sync demo accounts when DEMO_SEED_VERSION changed. Safe on every server start.
 */
export async function syncDemoAccountsIfNeeded(prisma, opts = {}) {
  if (process.env.SYNC_DEMO_ACCOUNTS !== 'true') {
    return { ran: false, reason: 'disabled' };
  }

  if (DEMO_EMAILS.length === 0) {
    return { ran: false, reason: 'no_demo_emails' };
  }

  const stored = await getStoredDemoVersion(prisma);
  if (stored === DEMO_SEED_VERSION && !opts.force) {
    return { ran: false, reason: 'up_to_date', version: DEMO_SEED_VERSION };
  }

  const log = opts.log ?? console.log;
  log(`\n🔄 Syncing demo accounts (v${stored ?? 'none'} → v${DEMO_SEED_VERSION})...`);
  await syncDemoAccounts(prisma, {
    log: (msg) => log(`   ✅ ${msg}`),
    resetPasswords: opts.force || process.env.RESET_DEMO_PASSWORDS === 'true',
  });
  await setStoredDemoVersion(prisma, DEMO_SEED_VERSION);
  log(`✅ Demo accounts synced to v${DEMO_SEED_VERSION} (password: ${DEMO_PASSWORD})\n`);

  return { ran: true, version: DEMO_SEED_VERSION };
}
