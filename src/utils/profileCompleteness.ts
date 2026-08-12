import type { UserProfile } from '../services/api';

export interface ProfileCheck {
  readonly label: string;
  readonly done: boolean;
}

export interface ProfileCompleteness {
  readonly score: number;
  readonly checks: readonly ProfileCheck[];
}

export function completenessScoreColor(score: number): string {
  if (score >= 80) return 'var(--color-ox-success)';
  if (score >= 50) return 'var(--color-ox-gold-muted)';
  return 'var(--color-ox-text-muted)';
}

export function completenessFillBackground(score: number): string {
  if (score >= 80) return 'var(--color-ox-success)';
  return 'linear-gradient(90deg, var(--color-ox-gold), #E6D08F)';
}

/** Citizen profile for settings or booking counterparty view */
export interface CitizenProfileInput {
  readonly name?: string | null;
  readonly phone?: string | null;
  readonly avatarUrl?: string | null;
  readonly bio?: string | null;
  readonly dob?: string | null;
  readonly gender?: string | null;
  readonly address?: string | null;
  readonly civilStatus?: string | null;
  readonly occupation?: string | null;
}

export function computeCitizenCompleteness(c: CitizenProfileInput): ProfileCompleteness {
  const bio = c.bio?.trim() || '';
  const hasLocation = !!c.address?.trim() || /davao|city|barangay|province/i.test(bio);
  const checks: ProfileCheck[] = [
    { label: 'Phone verified', done: !!c.phone },
    { label: 'Full name on file', done: !!c.name && c.name.trim().length >= 2 },
    { label: 'Profile photo uploaded', done: !!c.avatarUrl },
    { label: 'About section added (30+ characters)', done: bio.length >= 30 },
    { label: 'Address on file', done: hasLocation },
    { label: 'Occupation noted', done: !!c.occupation?.trim() },
  ];
  const done = checks.filter((x) => x.done).length;
  return { score: Math.round((done / checks.length) * 100), checks };
}

/** Lawyer — from UserProfile (settings) or LawyerProfile (public) */
export function computeLawyerCompleteness(l: {
  readonly barNumber?: string | null;
  readonly bio?: string | null;
  readonly avatarUrl?: string | null;
  readonly credentials?: readonly unknown[];
  readonly practiceType?: string | null;
  readonly consultationFee?: number | null;
  readonly consultationFeeMin?: number | null;
  readonly consultationFeeMax?: number | null;
  readonly paymentMethods?: readonly unknown[];
  readonly specializations?: readonly string[];
  readonly lawyerVerificationStatus?: string | null;
}): ProfileCompleteness {
  const credentials = l.credentials ?? [];
  const specializations = l.specializations ?? [];
  const status = (l.lawyerVerificationStatus || '').toUpperCase();
  const idVerified = status === 'VERIFIED';
  const checks: ProfileCheck[] = [
    { label: 'Phone verified', done: true },
    { label: 'IBP / Roll number filled', done: !!l.barNumber && /^\d{4,6}$/.test(l.barNumber) },
    { label: 'Identity verification (KYC) complete', done: idVerified },
    { label: 'Profile bio added', done: !!l.bio && l.bio.length >= 30 },
    { label: 'Profile photo uploaded', done: !!l.avatarUrl },
    { label: 'At least one credential proof', done: credentials.length > 0 },
    {
      label: 'Practice type & fee range set',
      done:
        !!l.practiceType
        && (l.practiceType === 'PUBLIC'
          || ((l.consultationFeeMin ?? l.consultationFee) != null
            && (l.consultationFeeMin ?? l.consultationFee)! > 0)),
    },
    {
      label: 'Payment method for bookings',
      done:
        (l.paymentMethods ?? []).length > 0
        || (l.practiceType === 'PUBLIC'
          && (l.consultationFeeMin ?? l.consultationFee ?? 0) <= 0
          && (l.consultationFeeMax ?? l.consultationFee ?? 0) <= 0),
    },
    { label: 'Specialization tags', done: specializations.length > 0 },
  ];
  const done = checks.filter((x) => x.done).length;
  return { score: Math.round((done / checks.length) * 100), checks };
}

export function computeUserCompleteness(user: UserProfile): ProfileCompleteness {
  if (user.role === 'LAWYER') {
    return computeLawyerCompleteness({
      barNumber: user.barNumber,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      credentials: user.credentials,
      practiceType: user.practiceType,
      consultationFee: user.consultationFee,
      consultationFeeMin: user.consultationFeeMin,
      consultationFeeMax: user.consultationFeeMax,
      paymentMethods: user.paymentMethods,
      specializations: user.specializations,
      lawyerVerificationStatus: user.lawyerVerificationStatus,
    });
  }
  return computeCitizenCompleteness({
    name: user.name,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    dob: user.dob,
    gender: user.gender,
    address: user.address,
    civilStatus: user.civilStatus,
    occupation: user.occupation,
  });
}
