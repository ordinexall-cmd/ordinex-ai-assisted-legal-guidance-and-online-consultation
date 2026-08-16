// ============================================================
// Ordinex — Demo account sync (idempotent)
// Bump DEMO_SEED_VERSION when demo tier/rules change in the app.
// ============================================================
import bcrypt from 'bcryptjs';

/** Increment when demo account fields or tier rules change. */
export const DEMO_SEED_VERSION = '5';

export const DEMO_META_KEY = 'demo_seed_version';

export const DEMO_PASSWORD = 'password123';

/** Demo account emails — these get simulated (free) payments instead of live PayMongo. */
export const DEMO_CITIZEN_EMAIL = 'citizen@ordinex.test';
export const DEMO_LAWYER_EMAIL = 'lawyer@ordinex.test';

export const DEMO_EMAILS = [
  DEMO_CITIZEN_EMAIL,
  DEMO_LAWYER_EMAIL,
];

/** Retired demo emails that must be deleted on sync. */
export const RETIRED_DEMO_EMAILS = [
  'citizen@test.com',
  'lawyer@test.com',
  'client@test.com',
  'publiclawyer@test.com',
  'premium@test.com',
];

export function isDemoEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return DEMO_EMAILS.includes(email.trim().toLowerCase());
}

const sampleCredential = (title) => ([{
  id: `seed-${title.toLowerCase().replace(/\s+/g, '-')}`,
  title,
  description: 'Sample verified bar credential for demo seed.',
  fileUrl: '/uploads/credentials/sample-placeholder.pdf',
  uploadedAt: new Date().toISOString(),
}]);

const DEMO_PAYMENT_METHODS = JSON.stringify([
  {
    id: 'demo-pm-ewallet',
    type: 'ewallet',
    provider: 'GCash',
    qrUrl: '/uploads/payments/demo-gcash-qr.png',
    accountName: 'Atty. Miguel Santos',
    accountNumber: '09190022002',
  },
  {
    id: 'demo-pm-bank',
    type: 'bank',
    bankName: 'BPI',
    accountName: 'Atty. Miguel Santos',
    accountNumber: '1234567890',
  },
]);

async function purgeRetiredDemoUsers(prisma, log) {
  const retired = await prisma.user.findMany({
    where: { email: { in: RETIRED_DEMO_EMAILS } },
    select: { id: true, email: true },
  });
  if (retired.length === 0) return;

  const userIds = retired.map((u) => u.id);
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

  if (bookingIds.length > 0) {
    await prisma.recordHash.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await prisma.review.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await prisma.booking.updateMany({
      where: { id: { in: bookingIds } },
      data: { paymentId: null },
    });
    await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
  }

  await prisma.payment.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.payoutRequest.deleteMany({ where: { lawyerId: { in: userIds } } });
  await prisma.consultation.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.review.deleteMany({ where: { citizenId: { in: userIds } } });
  await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.report.deleteMany({
    where: {
      OR: [
        { reporterId: { in: userIds } },
        { reportedUserId: { in: userIds } },
      ],
    },
  });
  await prisma.availability.deleteMany({ where: { lawyerId: { in: userIds } } });
  await prisma.lawyerVerification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.subscription.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });

  for (const u of retired) {
    log(`removed retired demo account ${u.email}`);
  }
}

/**
 * Upsert the demo users and credentials.
 */
export async function syncDemoAccounts(prisma, opts = {}) {
  const log = opts.log ?? (() => {});
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  await purgeRetiredDemoUsers(prisma, log);

  // 1. Citizen Demo
  const citizenData = {
    phone: '09170011001',
    passwordHash,
    role: 'CITIZEN',
    name: 'Ana Marie Reyes',
    firstName: 'Ana Marie',
    lastName: 'Reyes',
    dob: '1992-08-21',
    gender: 'Female',
    civilStatus: 'Single',
    citizenship: 'Filipino',
    occupation: 'Teacher',
    indigencyTier: 'STANDARD',
    citizenIdType: 'PHILID',
    citizenIdNumber: '9000-1111-2222-3333',
    region: 'Region XI',
    province: 'Davao del Sur',
    city: 'Davao City',
    barangay: 'Poblacion',
    streetAddress: '45 Claveria Street',
    address: '45 Claveria Street, Brgy. Poblacion, Davao City, Davao del Sur, Region XI',
    isVerified: true,
    citizenVerificationStatus: 'VERIFIED',
    citizenIdUrl: '/uploads/verification/demo-citizen-id.jpg',
    citizenSelfieUrl: '/uploads/verification/demo-citizen-selfie.jpg',
    avatarUrl: '/uploads/avatars/demo-citizen.jpg',
    emergencyContactName: 'Carlo Reyes',
    emergencyContactPhone: '09170011999',
    emergencyRelationship: 'Brother',
    emailVerified: true,
    isPremium: false,
    trialsUsed: 0,
    isFirstLogin: false,
  };

  const citizen = await prisma.user.upsert({
    where: { email: DEMO_CITIZEN_EMAIL },
    update: citizenData,
    create: { email: DEMO_CITIZEN_EMAIL, ...citizenData },
  });
  log(`${DEMO_CITIZEN_EMAIL} (Verified Citizen — Ana Marie Reyes)`);

  // 2. Private Practice Lawyer
  const privateCreds = JSON.stringify(sampleCredential('Supreme Court Bar Certificate'));
  const demoRoll = '67890';
  await prisma.rollOfAttorneys.upsert({
    where: { rollNumber: demoRoll },
    create: {
      rollNumber: demoRoll,
      fullName: 'Miguel Santos',
      admittedAt: new Date('2016-05-03'),
      region: 'Region XI',
      status: 'ACTIVE',
    },
    update: {
      fullName: 'Miguel Santos',
      status: 'ACTIVE',
      region: 'Region XI',
    },
  });

  const lawyerData = {
    phone: '09190022002',
    passwordHash,
    role: 'LAWYER',
    name: 'Atty. Miguel Santos',
    firstName: 'Miguel',
    lastName: 'Santos',
    barNumber: demoRoll,
    barAdmissionYear: 2016,
    ibpChapter: 'Davao del Sur',
    ibpIdNumber: 'IBP-DVO-2016-4410',
    ptrNumber: 'PTR-2026-441022',
    ptrLgu: 'Davao City',
    mcleComplianceNo: 'MCLE Compliance No. VIII-002410',
    lawFirmName: 'Santos & Associates Law Office',
    specializations: JSON.stringify(['Criminal Law', 'Family Law', 'Corporate & Business']),
    consultationFee: 1500,
    consultationFeeMin: 1500,
    consultationFeeMax: 3000,
    bio: 'Trial and appellate counsel based in Davao City, with eight years of practice in criminal, family, and commercial matters.',
    yearsOfExperience: 8,
    practiceType: 'PRIVATE',
    region: 'Region XI',
    province: 'Davao del Sur',
    city: 'Davao City',
    barangay: 'Poblacion',
    address: 'Santos Law, C.M. Recto Ave, Davao City, Davao del Sur',
    isVerified: true,
    lawyerVerificationStatus: 'VERIFIED',
    lawyerVerificationScore: 100,
    lawyerVerificationUpdatedAt: new Date(),
    credentials: privateCreds,
    paymentMethods: DEMO_PAYMENT_METHODS,
    rating: 4.8,
    ratingCount: 22,
    isFirstLogin: false,
    acceptingBookings: true,
  };

  const lawyer = await prisma.user.upsert({
    where: { email: DEMO_LAWYER_EMAIL },
    update: lawyerData,
    create: { email: DEMO_LAWYER_EMAIL, ...lawyerData },
  });

  await prisma.lawyerVerification.upsert({
    where: { userId: lawyer.id },
    create: {
      userId: lawyer.id,
      submittedFullName: 'Miguel Santos',
      submittedRollNumber: demoRoll,
      rollMatchedName: 'Miguel Santos',
      rollMatchHit: true,
      decision: 'AUTO_APPROVE',
      decisionReason: 'Verified Philippine Bar Counsel (Supreme Court Roll No. 67890, IBP Davao del Sur).',
      decisionAt: new Date(),
      aggregateConfidence: 100,
      attempts: 1,
      lastSubmittedAt: new Date(),
    },
    update: {
      submittedFullName: 'Miguel Santos',
      submittedRollNumber: demoRoll,
      rollMatchedName: 'Miguel Santos',
      rollMatchHit: true,
      decision: 'AUTO_APPROVE',
      decisionReason: 'Verified Philippine Bar Counsel (Supreme Court Roll No. 67890, IBP Davao del Sur).',
      decisionAt: new Date(),
      aggregateConfidence: 100,
    },
  });
  log(`${DEMO_LAWYER_EMAIL} (SC VERIFIED — Atty. Miguel Santos)`);

  if (opts.resetPasswords) {
    await prisma.user.updateMany({
      where: {
        email: { in: DEMO_EMAILS },
      },
      data: { passwordHash },
    });
    log('passwords reset to password123');
  }

  return { citizen, lawyer, version: DEMO_SEED_VERSION };
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
