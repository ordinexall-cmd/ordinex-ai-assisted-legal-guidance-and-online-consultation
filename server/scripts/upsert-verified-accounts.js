/**
 * Upsert fully verified real accounts (not demo@ordinex.test).
 *
 * Usage (from server/):
 *   CITIZEN_EMAIL=... CITIZEN_PASSWORD=... CITIZEN_PHONE=09... \
 *   LAWYER_EMAIL=... LAWYER_PASSWORD=... LAWYER_PHONE=09... \
 *   node scripts/upsert-verified-accounts.js
 *
 * Optional: CITIZEN_NAME, LAWYER_NAME, LAWYER_ROLL
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function required(name) {
  const v = String(process.env[name] || '').trim();
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

async function upsertCitizen() {
  const email = required('CITIZEN_EMAIL').toLowerCase();
  const password = required('CITIZEN_PASSWORD');
  const phone = required('CITIZEN_PHONE');
  const name = String(process.env.CITIZEN_NAME || 'Citizen User').trim();
  const parts = name.split(/\s+/);
  const firstName = parts[0] || 'Citizen';
  const lastName = parts.slice(1).join(' ') || 'User';
  const passwordHash = await bcrypt.hash(password, 12);

  const data = {
    phone,
    passwordHash,
    role: 'CITIZEN',
    name,
    firstName,
    lastName,
    dob: '1995-01-15',
    gender: 'Prefer not to say',
    civilStatus: 'Single',
    citizenship: 'Filipino',
    occupation: 'Professional',
    indigencyTier: 'STANDARD',
    citizenIdType: 'PHILID',
    citizenIdNumber: '0000-0000-0000-0001',
    region: 'Region XI',
    province: 'Davao del Sur',
    city: 'Davao City',
    barangay: 'Poblacion',
    streetAddress: 'Verified Account',
    address: 'Verified Account, Brgy. Poblacion, Davao City, Davao del Sur, Region XI',
    isVerified: true,
    citizenVerificationStatus: 'VERIFIED',
    emailVerified: true,
    isPremium: false,
    trialsUsed: 0,
    isFirstLogin: false,
    isBanned: false,
    suspensionUntil: null,
    suspensionReason: null,
  };

  const user = await prisma.user.upsert({
    where: { email },
    update: data,
    create: { email, ...data },
  });
  console.log(`OK citizen ${user.email} id=${user.id} verified=${user.isVerified} emailVerified=${user.emailVerified}`);
  return user;
}

async function upsertLawyer() {
  const email = required('LAWYER_EMAIL').toLowerCase();
  const password = required('LAWYER_PASSWORD');
  const phone = required('LAWYER_PHONE');
  const name = String(process.env.LAWYER_NAME || 'Atty. Verified Counsel').trim();
  const roll = String(process.env.LAWYER_ROLL || '99001').trim();
  const plainName = name.replace(/^Atty\.?\s*/i, '').trim() || 'Verified Counsel';
  const parts = plainName.split(/\s+/);
  const firstName = parts[0] || 'Verified';
  const lastName = parts.slice(1).join(' ') || 'Counsel';
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.rollOfAttorneys.upsert({
    where: { rollNumber: roll },
    create: {
      rollNumber: roll,
      fullName: plainName,
      admittedAt: new Date('2018-05-01'),
      region: 'Region XI',
      status: 'ACTIVE',
    },
    update: {
      fullName: plainName,
      status: 'ACTIVE',
      region: 'Region XI',
    },
  });

  const paymentMethods = JSON.stringify([
    {
      id: 'capstone-pm-ewallet',
      type: 'ewallet',
      provider: 'GCash',
      accountName: name,
      accountNumber: phone,
    },
  ]);

  const data = {
    phone,
    passwordHash,
    role: 'LAWYER',
    name: name.startsWith('Atty') ? name : `Atty. ${plainName}`,
    firstName,
    lastName,
    barNumber: roll,
    barAdmissionYear: 2018,
    ibpChapter: 'Davao del Sur',
    ibpIdNumber: `IBP-DVO-${roll}`,
    ptrNumber: `PTR-2026-${roll}`,
    ptrLgu: 'Davao City',
    mcleComplianceNo: `MCLE Compliance No. VIII-${roll}`,
    lawFirmName: `${lastName} Law Office`,
    specializations: JSON.stringify(['Criminal Law', 'Family Law', 'Civil Law']),
    consultationFee: 1500,
    consultationFeeMin: 1500,
    consultationFeeMax: 3000,
    bio: 'Fully verified Philippine Bar counsel for Ordinex production use.',
    yearsOfExperience: 6,
    practiceType: 'PRIVATE',
    region: 'Region XI',
    province: 'Davao del Sur',
    city: 'Davao City',
    barangay: 'Poblacion',
    address: `${lastName} Law, Davao City, Davao del Sur`,
    isVerified: true,
    lawyerVerificationStatus: 'VERIFIED',
    lawyerVerificationScore: 100,
    lawyerVerificationUpdatedAt: new Date(),
    emailVerified: true,
    credentials: JSON.stringify([
      {
        id: `cred-${roll}`,
        title: 'Supreme Court Bar Certificate',
        description: 'Verified bar credential.',
        fileUrl: '/uploads/credentials/sample-placeholder.pdf',
        uploadedAt: new Date().toISOString(),
      },
    ]),
    paymentMethods,
    rating: 5,
    ratingCount: 1,
    isFirstLogin: false,
    acceptingBookings: true,
    isBanned: false,
    suspensionUntil: null,
    suspensionReason: null,
  };

  const user = await prisma.user.upsert({
    where: { email },
    update: data,
    create: { email, ...data },
  });

  await prisma.lawyerVerification.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      submittedFullName: plainName,
      submittedRollNumber: roll,
      rollMatchedName: plainName,
      rollMatchHit: true,
      decision: 'AUTO_APPROVE',
      decisionReason: `Verified Philippine Bar Counsel (Roll No. ${roll}).`,
      decisionAt: new Date(),
      aggregateConfidence: 100,
      attempts: 1,
      lastSubmittedAt: new Date(),
    },
    update: {
      submittedFullName: plainName,
      submittedRollNumber: roll,
      rollMatchedName: plainName,
      rollMatchHit: true,
      decision: 'AUTO_APPROVE',
      decisionReason: `Verified Philippine Bar Counsel (Roll No. ${roll}).`,
      decisionAt: new Date(),
      aggregateConfidence: 100,
    },
  });

  console.log(`OK lawyer ${user.email} id=${user.id} verified=${user.isVerified} status=${user.lawyerVerificationStatus}`);
  return user;
}

async function main() {
  await upsertCitizen();
  await upsertLawyer();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
