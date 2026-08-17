/**
 * OnlineJobs.ph-inspired Trust & ID Proof Scoring Engine
 * Computes transparent, verifiable 0-100 ID Proof trust scores for Citizens and Lawyers.
 */

export interface TrustCheckItem {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly points: number;
  readonly maxPoints: number;
  readonly verified: boolean;
  readonly icon: string;
}

export interface TrustScoreResult {
  readonly score: number;
  readonly maxScore: number;
  readonly level: 'UNVERIFIED' | 'BASIC' | 'VERIFIED' | 'TOP_TIER';
  readonly badgeLabel: string;
  readonly badgeColor: string;
  readonly checks: readonly TrustCheckItem[];
}

export function computeCitizenTrustScore(citizen: {
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly name?: string | null;
  readonly address?: string | null;
  readonly dob?: string | null;
  readonly civilStatus?: string | null;
  readonly citizenIdNumber?: string | null;
  readonly citizenIdUrl?: string | null;
  readonly citizenSelfieUrl?: string | null;
  readonly isVerified?: boolean | null;
  readonly citizenVerificationStatus?: string | null;
  readonly emergencyContactName?: string | null;
  readonly avatarUrl?: string | null;
}): TrustScoreResult {
  const isGovIdVerified = !!(
    citizen.citizenVerificationStatus === 'VERIFIED'
    && (citizen.citizenSelfieUrl || citizen.isVerified)
  );

  const checks: TrustCheckItem[] = [
    {
      id: 'contact_verified',
      label: 'Email & Mobile Verified',
      description: 'Account contact channels verified via 6-digit OTP code.',
      points: citizen.phone && citizen.email ? 20 : 0,
      maxPoints: 20,
      verified: !!(citizen.phone && citizen.email),
      icon: 'verified_user',
    },
    {
      id: 'psgc_address',
      label: 'Philippine Domicile (PSGC)',
      description: 'Barangay, City, and Province established for legal jurisdiction.',
      points: citizen.address && citizen.address.trim().length >= 5 ? 20 : 0,
      maxPoints: 20,
      verified: !!(citizen.address && citizen.address.trim().length >= 5),
      icon: 'location_on',
    },
    {
      id: 'legal_capacity',
      label: 'Age (18+) & Demographics',
      description: 'Legal majority capacity and civil status recorded.',
      points: citizen.dob && citizen.civilStatus ? 20 : 0,
      maxPoints: 20,
      verified: !!(citizen.dob && citizen.civilStatus),
      icon: 'badge',
    },
    {
      id: 'gov_id',
      label: 'Government ID Verified',
      description: 'Valid Philippine government ID plus a selfie holding that ID.',
      points: isGovIdVerified ? 20 : 0,
      maxPoints: 20,
      verified: isGovIdVerified,
      icon: 'credit_card',
    },
    {
      id: 'profile_emergency',
      label: 'Photo & Emergency Contact',
      description: 'Profile avatar and next-of-kin representative for emergencies.',
      points: (citizen.avatarUrl ? 10 : 0) + (citizen.emergencyContactName ? 10 : 0),
      maxPoints: 20,
      verified: !!(citizen.avatarUrl && citizen.emergencyContactName),
      icon: 'contact_emergency',
    },
  ];

  const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);

  let level: TrustScoreResult['level'] = 'UNVERIFIED';
  let badgeLabel: string;
  let badgeColor = '#94a3b8';

  if (totalPoints >= 100) {
    level = 'TOP_TIER';
    badgeLabel = '100 / 100';
    badgeColor = '#10b981';
  } else if (totalPoints >= 80) {
    level = 'TOP_TIER';
    badgeLabel = `${totalPoints} / 100`;
    badgeColor = '#10b981';
  } else if (totalPoints >= 60) {
    level = 'VERIFIED';
    badgeLabel = `${totalPoints} / 100`;
    badgeColor = '#059669';
  } else if (totalPoints >= 30) {
    level = 'BASIC';
    badgeLabel = `${totalPoints} / 100`;
    badgeColor = '#f59e0b';
  } else {
    badgeLabel = `${totalPoints} / 100`;
  }

  return {
    score: totalPoints,
    maxScore: 100,
    level,
    badgeLabel,
    badgeColor,
    checks,
  };
}

export function isCitizenBookingUnlocked(
  citizen: Parameters<typeof computeCitizenTrustScore>[0] | null | undefined,
): boolean {
  if (!citizen) return false;
  return computeCitizenTrustScore(citizen).score >= 100;
}

export function computeLawyerTrustScore(lawyer: {
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly isVerified?: boolean;
  readonly barNumber?: string | null;
  readonly ibpChapter?: string | null;
  readonly lawyerVerificationStatus?: string | null;
  readonly avatarUrl?: string | null;
  readonly credentials?: readonly unknown[] | null;
  readonly specializations?: readonly string[] | null;
}): TrustScoreResult {
  const isKycVerified = lawyer.isVerified || (lawyer.lawyerVerificationStatus || '').toUpperCase() === 'VERIFIED';
  const hasBarRoll = !!(lawyer.barNumber && /^\d{4,6}$/.test(lawyer.barNumber.trim()));

  const checks: TrustCheckItem[] = [
    {
      id: 'phone_email',
      label: 'Verified Contact',
      description: 'Official phone and email authenticated with OTP.',
      points: lawyer.phone && lawyer.email ? 20 : 0,
      maxPoints: 20,
      verified: !!(lawyer.phone && lawyer.email),
      icon: 'verified_user',
    },
    {
      id: 'sc_roll',
      label: 'SC Roll of Attorneys',
      description: 'Registered Philippine Supreme Court Roll Number & IBP Chapter.',
      points: hasBarRoll ? 25 : 0,
      maxPoints: 25,
      verified: hasBarRoll,
      icon: 'gavel',
    },
    {
      id: 'biometric_kyc',
      label: 'Biometric & SC Card KYC',
      description: 'Attorney ID OCR match and live selfie liveness audit.',
      points: isKycVerified ? 35 : 0,
      maxPoints: 35,
      verified: isKycVerified,
      icon: 'verified',
    },
    {
      id: 'practice_credentials',
      label: 'Practice & Credentials',
      description: 'Practice specializations, credentials, and profile photo.',
      points: (lawyer.avatarUrl ? 10 : 0) + ((lawyer.specializations?.length || 0) > 0 ? 10 : 0),
      maxPoints: 20,
      verified: !!(lawyer.avatarUrl && (lawyer.specializations?.length || 0) > 0),
      icon: 'assignment_turned_in',
    },
  ];

  const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);

  let level: TrustScoreResult['level'] = 'UNVERIFIED';
  let badgeLabel = `${totalPoints} ID PROOF`;
  let badgeColor = '#94a3b8';

  if (isKycVerified && totalPoints >= 80) {
    level = 'TOP_TIER';
    badgeLabel = '100 ID PROOF';
    badgeColor = '#10b981'; // Emerald
  } else if (totalPoints >= 60) {
    level = 'VERIFIED';
    badgeColor = '#059669';
  } else if (totalPoints >= 30) {
    level = 'BASIC';
    badgeColor = '#f59e0b';
  }

  return {
    score: isKycVerified ? 100 : totalPoints,
    maxScore: 100,
    level,
    badgeLabel: isKycVerified ? '100 ID PROOF' : badgeLabel,
    badgeColor: isKycVerified ? '#10b981' : badgeColor,
    checks,
  };
}
