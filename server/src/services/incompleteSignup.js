import { prisma } from '../config/prisma.js';
import { DEMO_EMAILS } from '../../prisma/demoAccounts.js';

const ACTIVITY_COUNT = {
  consultations: true,
  bookingsAsCitizen: true,
  bookingsAsLawyer: true,
  payments: true,
  payoutRequests: true,
  caseBriefs: true,
  availabilities: true,
};

export const incompleteSignupInclude = {
  _count: { select: ACTIVITY_COUNT },
};

function hasActivity(user) {
  const c = user?._count;
  if (!c) return true;
  return (
    c.consultations > 0
    || c.bookingsAsCitizen > 0
    || c.bookingsAsLawyer > 0
    || c.payments > 0
    || c.payoutRequests > 0
    || c.caseBriefs > 0
    || c.availabilities > 0
  );
}

export function isIncompleteSignup(user) {
  if (!user || user.isBanned) return false;
  if (DEMO_EMAILS.includes(String(user.email || '').toLowerCase())) return false;
  if (user.emailVerified || user.googleId) return false;
  if (hasActivity(user)) return false;
  if (user.role === 'LAWYER') {
    return user.isVerified !== true && (user.lawyerVerificationStatus || 'NOT_STARTED') === 'NOT_STARTED';
  }
  return (user.citizenVerificationStatus || 'NOT_STARTED') === 'NOT_STARTED' && (user.trialsUsed || 0) === 0;
}

export async function reclaimIfIncomplete(user) {
  if (!isIncompleteSignup(user)) return false;
  try {
    await prisma.user.delete({ where: { id: user.id } });
    return true;
  } catch (err) {
    console.warn('[auth] could not reclaim incomplete user', user.id, err?.message);
    return false;
  }
}

/** Delete leftover incomplete accounts that collide on email or phone. */
export async function reclaimIncompleteMatches({ email, phone }) {
  const or = [];
  if (email) or.push({ email: String(email).trim().toLowerCase() });
  if (phone) or.push({ phone });
  if (!or.length) return { blocked: null };

  const matches = await prisma.user.findMany({
    where: { OR: or },
    include: incompleteSignupInclude,
  });

  const remaining = [];
  for (const row of matches) {
    if (await reclaimIfIncomplete(row)) continue;
    remaining.push(row);
  }
  return { blocked: remaining[0] || null };
}
