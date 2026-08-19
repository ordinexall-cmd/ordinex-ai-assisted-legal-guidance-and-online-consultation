// ============================================================
// Ordinex - Lawyer Verification Orchestrator
//
// Implements the no-admin, deterministic, AI-assisted lawyer
// verification pipeline described in the Lawyer Verification
// blueprint:
//
//   1. SC Roll cross-reference (must hit before ID upload)
//   2. Government ID upload + OCR name extraction
//   3. Dynamic selfie with handwritten challenge code
//   4. Optional payment-account name match (GCash / bank)
//   5. AI confidence aggregation → AUTO_APPROVE | NEEDS_REUPLOAD
//      | AUTO_REJECT, with cooldown on hard reject.
// ============================================================
import crypto from 'crypto';
import { prisma } from '../config/prisma.js';
import { extractIdText, OCR_PROVIDER_WEIGHTS } from './ocrService.js';
import { compareFaces, FACE_PROVIDER_WEIGHTS } from './faceMatchService.js';
import { nameSimilarity, normalizeFullName } from '../utils/stringDistance.js';
import { sendLawyerVerifiedEmail } from './email.js';
import { env } from '../config/env.js';
import { isDemoEmail } from '../../prisma/demoAccounts.js';
import { lookupScRollEntry, findSeedRollEntry } from './scRollLookup.js';

const HIGH_CONFIDENCE_THRESHOLD = 85;
const MEDIUM_CONFIDENCE_THRESHOLD = 60;
const COOLDOWN_DAYS_ON_REJECT = 30;
const CHALLENGE_TTL_HOURS = 24;

export const VERIFICATION_STATUS = Object.freeze({
  NOT_STARTED: 'NOT_STARTED',
  PENDING_UPLOAD: 'PENDING_UPLOAD',
  PROCESSING: 'PROCESSING',
  NEEDS_REUPLOAD: 'NEEDS_REUPLOAD',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
});

export const VERIFICATION_DECISION = Object.freeze({
  PENDING: 'PENDING',
  AUTO_APPROVE: 'AUTO_APPROVE',
  NEEDS_REUPLOAD: 'NEEDS_REUPLOAD',
  AUTO_REJECT: 'AUTO_REJECT',
});

const VALID_GOV_ID_TYPES = new Set([
  'PRC', 'IBP_ID', 'DRIVER', 'PASSPORT', 'NBI',
  'UMID', 'VOTER', 'POSTAL', 'PHL_ID',
]);

function fmtCode() {
  const day = new Date();
  const y = day.getFullYear();
  const m = String(day.getMonth() + 1).padStart(2, '0');
  const d = String(day.getDate()).padStart(2, '0');
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `ORD-${y}-${m}${d}-${rand}`;
}

function isCodeFresh(issuedAt) {
  if (!issuedAt) return false;
  const ms = CHALLENGE_TTL_HOURS * 60 * 60 * 1000;
  return Date.now() - new Date(issuedAt).getTime() < ms;
}

/** Official SC Lawyers List lookup; demo accounts may use the local seed. */
async function findRollEntry({ rollNumber, fullName, allowSeed }) {
  const live = await lookupScRollEntry({ rollNumber, fullName });
  if (live.unavailable) return live;
  if (live.entry) return live;
  if (allowSeed) {
    const seed = await findSeedRollEntry({ rollNumber, fullName });
    return { entry: seed };
  }
  return { entry: null };
}

async function ensureVerificationRow(userId) {
  let row = await prisma.lawyerVerification.findUnique({ where: { userId } });
  if (!row) {
    row = await prisma.lawyerVerification.create({ data: { userId } });
  }
  return row;
}

/**
 * Step 1 — submit professional info; cross-check against the live
 * Supreme Court Lawyers List (cached). On hit, the lawyer is moved to PENDING_UPLOAD.
 */
export async function startVerification({ user, fullName, rollNumber }) {
  if (user.role !== 'LAWYER') {
    throw new Error('Only lawyers can start verification.');
  }
  if (user.lawyerVerificationCooldownUntil &&
      new Date(user.lawyerVerificationCooldownUntil) > new Date()) {
    return {
      ok: false,
      code: 'COOLDOWN',
      message: 'This account is in a verification cooldown. Try again after the cooldown period.',
    };
  }

  const trimmedName = (fullName || '').trim();
  const trimmedRoll = (rollNumber || '').trim();

  if (!trimmedName || !trimmedRoll) {
    return { ok: false, code: 'MISSING_INPUT', message: 'Full legal name and SC roll number are required.' };
  }

  const lookup = await findRollEntry({
    rollNumber: trimmedRoll,
    fullName: trimmedName,
    allowSeed: isDemoEmail(user.email),
  });
  if (lookup.unavailable) {
    return {
      ok: false,
      code: 'ROLL_UNAVAILABLE',
      message: lookup.message || 'We could not reach the Supreme Court Lawyers List right now. Please try again in a few minutes.',
    };
  }
  const rollEntry = lookup.entry;
  if (rollEntry && rollEntry.status && rollEntry.status !== 'ACTIVE') {
    return {
      ok: false,
      code: 'ROLL_INACTIVE',
      message: `This roll number is marked ${rollEntry.status} on the registry and cannot be verified for practice on Ordinex.`,
    };
  }

  // One active verified (or in-progress) account per roll number
  const rollOwner = await prisma.lawyerVerification.findFirst({
    where: {
      submittedRollNumber: trimmedRoll,
      userId: { not: user.id },
      user: {
        OR: [
          { isVerified: true },
          { lawyerVerificationStatus: { in: ['PENDING_UPLOAD', 'PROCESSING', 'VERIFIED', 'NEEDS_REUPLOAD'] } },
        ],
      },
    },
    select: { userId: true },
  });
  if (rollOwner) {
    return {
      ok: false,
      code: 'ROLL_IN_USE',
      message: 'This SC roll number is already linked to another Ordinex lawyer account.',
    };
  }

  const rollHit = !!rollEntry && nameSimilarity(rollEntry.fullName, trimmedName) >= 0.55;

  const row = await ensureVerificationRow(user.id);
  const challenge = fmtCode();

  const updated = await prisma.lawyerVerification.update({
    where: { id: row.id },
    data: {
      submittedFullName: trimmedName,
      submittedRollNumber: trimmedRoll,
      rollMatchedName: rollEntry?.fullName || null,
      rollMatchHit: rollHit,
      challengeCode: challenge,
      challengeIssuedAt: new Date(),
      attempts: { increment: 1 },
      lastSubmittedAt: new Date(),
      decision: VERIFICATION_DECISION.PENDING,
      decisionReason: null,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lawyerVerificationStatus: rollHit
        ? VERIFICATION_STATUS.PENDING_UPLOAD
        : VERIFICATION_STATUS.NOT_STARTED,
      lawyerVerificationUpdatedAt: new Date(),
      // capture barNumber for backward compatibility with existing checks
      barNumber: user.barNumber || (/^\d{4,6}$/.test(trimmedRoll) ? trimmedRoll : user.barNumber),
    },
  });

  return {
    ok: rollHit,
    code: rollHit ? 'ROLL_MATCH' : 'ROLL_MISS',
    message: rollHit
      ? 'Roll number matched. Proceed to upload your government ID.'
      : 'We could not match your SC roll entry. Double-check your roll number and full legal name on the SC Roll of Attorneys.',
    challengeCode: challenge,
    challengeExpiresInHours: CHALLENGE_TTL_HOURS,
    verification: serializeVerification(updated),
  };
}

/**
 * Step 2 — government ID upload.
 * @param {{ user, govIdUrl, govIdType, govIdBuffer? }} args
 */
export async function attachGovernmentId({ user, govIdUrl, govIdType, govIdBuffer }) {
  if (!govIdUrl) throw new Error('govIdUrl is required.');
  if (!VALID_GOV_ID_TYPES.has(govIdType)) {
    throw new Error(`Unsupported ID type: ${govIdType}`);
  }
  const row = await ensureVerificationRow(user.id);

  // Run OCR best-effort; pass the lawyer's entered name as a soft fallback
  // so the scoring engine still has comparable text even without Tesseract.
  let ocrResult = { provider: 'noop', rawText: '', extractedName: row.submittedFullName || '' };
  if (govIdBuffer) {
    ocrResult = await extractIdText({
      buffer: govIdBuffer,
      fallbackName: row.submittedFullName || '',
    });
  }

  const updated = await prisma.lawyerVerification.update({
    where: { id: row.id },
    data: {
      govIdType,
      govIdUrl,
      govIdOcrName: ocrResult.extractedName || null,
      govIdOcrProvider: ocrResult.provider || null,
      govIdUploadedAt: new Date(),
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lawyerVerificationStatus: VERIFICATION_STATUS.PENDING_UPLOAD,
      lawyerVerificationUpdatedAt: new Date(),
    },
  });

  return {
    ok: true,
    ocrProvider: ocrResult.provider,
    extractedName: ocrResult.extractedName,
    verification: serializeVerification(updated),
  };
}

/**
 * Step 3 — selfie with handwritten challenge code.
 * Pass the buffer of both the ID and the selfie to enable face match.
 */
export async function attachSelfie({
  user,
  selfieUrl,
  selfieBuffer,
  govIdBuffer,
  reportedCode,
}) {
  if (!selfieUrl) throw new Error('selfieUrl is required.');
  const row = await ensureVerificationRow(user.id);

  if (!isCodeFresh(row.challengeIssuedAt)) {
    return {
      ok: false,
      code: 'STALE_CHALLENGE',
      message: 'Your selfie challenge code expired. Re-issue a code and try again.',
    };
  }

  const codeMatched =
    !!reportedCode &&
    reportedCode.replace(/\s+/g, '').toUpperCase() ===
      (row.challengeCode || '').replace(/\s+/g, '').toUpperCase();

  const face = await compareFaces({
    idBuffer: govIdBuffer || Buffer.from(row.govIdUrl || 'no-id'),
    selfieBuffer,
  });

  const updated = await prisma.lawyerVerification.update({
    where: { id: row.id },
    data: {
      selfieUrl,
      selfieUploadedAt: new Date(),
      faceMatchScore: face.score,
      faceMatchProvider: face.provider || null,
      challengeCodeMatched: codeMatched,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lawyerVerificationStatus: VERIFICATION_STATUS.PROCESSING,
      lawyerVerificationUpdatedAt: new Date(),
    },
  });

  return {
    ok: true,
    faceProvider: face.provider,
    faceMatchScore: face.score,
    challengeCodeMatched: codeMatched,
    verification: serializeVerification(updated),
  };
}

/**
 * Optional step 4 — payment-account name match.
 */
export async function attachPaymentName({ user, paymentAccountName }) {
  const trimmed = (paymentAccountName || '').trim();
  if (!trimmed) throw new Error('paymentAccountName is required.');

  const row = await ensureVerificationRow(user.id);
  const sim = nameSimilarity(
    trimmed,
    row.rollMatchedName || row.submittedFullName || user.name || '',
  );

  const updated = await prisma.lawyerVerification.update({
    where: { id: row.id },
    data: {
      paymentAccountName: trimmed,
      paymentNameMatchScore: sim,
    },
  });

  return {
    ok: true,
    paymentNameMatchScore: sim,
    verification: serializeVerification(updated),
  };
}

/**
 * Pure scoring/decision helper extracted from scoreAndDecide.
 * Takes the verification row + (optionally) provider hints and returns
 * { score, decision, status, reason, ocrNameSim } without touching the DB.
 *
 * Exposed so tests can lock the High/Medium/Low confidence thresholds and
 * provider weighting without spinning up Prisma.
 */
export function computeVerificationOutcome(row, {
  faceProviderOverride,
  ocrProviderOverride,
} = {}) {
  const FACE_W = 0.40;
  const OCR_W = 0.25;
  const ROLL_W = 0.20;
  const CODE_W = 0.10;
  const PAY_W = 0.05;

  const ocrNameSim =
    row.govIdOcrName
      ? nameSimilarity(row.govIdOcrName, row.rollMatchedName || row.submittedFullName || '')
      : 0;

  // Prefer the persisted provider (set when the AI engine actually ran).
  // Fall back to the legacy inference for rows created before provider
  // columns existed.
  const faceProvider = faceProviderOverride
    ?? row.faceMatchProvider
    ?? (row.faceMatchScore == null ? null : (row.faceMatchScore > 0 ? 'hash-stub' : 'noop'));
  const ocrProvider = ocrProviderOverride
    ?? row.govIdOcrProvider
    ?? (row.govIdOcrName ? 'tesseract.js' : 'noop');

  // Provider-aware down-weighting: when face/OCR providers are stubs
  // (or absent), multiply ONLY their contribution — do NOT shrink the
  // denominator. This means a verification driven entirely by stubs
  // cannot reach AUTO_APPROVE even if every non-stub signal is perfect.
  const faceProviderWeight = FACE_PROVIDER_WEIGHTS[faceProvider] ?? 0;
  const ocrProviderWeight = OCR_PROVIDER_WEIGHTS[ocrProvider] ?? 0.3;

  const faceContribution = (row.faceMatchScore ?? 0) * FACE_W * faceProviderWeight;
  const ocrContribution = ocrNameSim * OCR_W * ocrProviderWeight;
  const rollContribution = (row.rollMatchHit ? 1 : 0) * ROLL_W;
  const codeContribution = (row.challengeCodeMatched ? 1 : 0) * CODE_W;
  const payContribution = (row.paymentNameMatchScore ?? 0) * PAY_W;

  // Fixed denominator over all configured weights. Optional payment match
  // is only counted when actually present so unsubmitted optional steps
  // don't deflate the score.
  const denom = FACE_W + OCR_W + ROLL_W + CODE_W +
    (row.paymentNameMatchScore != null ? PAY_W : 0);

  const score100 = denom > 0
    ? Math.round(
        ((faceContribution + ocrContribution + rollContribution +
          codeContribution + payContribution) / denom) * 100,
      )
    : 0;

  const hardFail =
    !row.rollMatchHit ||
    !row.govIdUrl ||
    !row.selfieUrl ||
    !row.challengeCodeMatched;

  let decision;
  let status;
  let reason = '';

  if (hardFail) {
    decision = VERIFICATION_DECISION.AUTO_REJECT;
    status = VERIFICATION_STATUS.REJECTED;
    reason = !row.rollMatchHit ? 'SC Roll match missing.' :
      !row.govIdUrl ? 'Government ID missing.' :
      !row.selfieUrl ? 'Selfie missing.' :
      'Selfie challenge code mismatch.';
  } else if (score100 >= HIGH_CONFIDENCE_THRESHOLD) {
    decision = VERIFICATION_DECISION.AUTO_APPROVE;
    status = VERIFICATION_STATUS.VERIFIED;
    reason = 'Identity verified with high confidence.';
  } else if (score100 >= MEDIUM_CONFIDENCE_THRESHOLD) {
    decision = VERIFICATION_DECISION.NEEDS_REUPLOAD;
    status = VERIFICATION_STATUS.NEEDS_REUPLOAD;
    reason = 'Identity match was borderline. Re-upload selfie or ID under better lighting.';
  } else {
    decision = VERIFICATION_DECISION.AUTO_REJECT;
    status = VERIFICATION_STATUS.REJECTED;
    reason = 'Identity match below acceptance threshold.';
  }

  return { score: score100, decision, status, reason, ocrNameSim };
}

/**
 * Final scoring step. Computes the aggregate identity-confidence score
 * and selects a tiered outcome:
 *   - score ≥ 85 → AUTO_APPROVE (isVerified = true)
 *   - score 60-85 → NEEDS_REUPLOAD (no admin needed; user re-uploads)
 *   - score < 60 → AUTO_REJECT (account suspended for 30-day cooldown)
 */
export async function scoreAndDecide({ user, providerOverrides } = {}) {
  const row = await ensureVerificationRow(user.id);
  const { score: score100, decision, status, reason, ocrNameSim } =
    computeVerificationOutcome(row, providerOverrides);

  const cooldownUntil =
    decision === VERIFICATION_DECISION.AUTO_REJECT
      ? new Date(Date.now() + COOLDOWN_DAYS_ON_REJECT * 24 * 60 * 60 * 1000)
      : null;

  // Operational logging — observability for the verification pipeline so ops
  // can grep decisions and tune thresholds without enabling debug mode.
  console.log(
    `[lawyerVerification] user=${user.id} score=${score100} decision=${decision} ` +
    `roll=${row.rollMatchHit} face=${row.faceMatchScore ?? 'n/a'} code=${row.challengeCodeMatched} ` +
    `ocrSim=${ocrNameSim.toFixed?.(2) ?? ocrNameSim}`,
  );

  const updatedRow = await prisma.lawyerVerification.update({
    where: { id: row.id },
    data: {
      aggregateConfidence: score100,
      ocrNameMatchScore: ocrNameSim,
      decision,
      decisionReason: reason,
      decisionAt: new Date(),
    },
  });

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      isVerified: decision === VERIFICATION_DECISION.AUTO_APPROVE,
      lawyerVerificationStatus: status,
      lawyerVerificationScore: score100,
      lawyerVerificationRejectionReason:
        decision === VERIFICATION_DECISION.AUTO_REJECT ? reason : null,
      lawyerVerificationCooldownUntil: cooldownUntil,
      lawyerVerificationUpdatedAt: new Date(),
    },
  });

  if (decision === VERIFICATION_DECISION.AUTO_APPROVE) {
    sendLawyerVerifiedEmail(updatedUser).catch((err) => {
      console.error('[lawyerVerification] verified email failed:', err.message);
    });
  }

  return {
    decision,
    status,
    score: score100,
    reason,
    cooldownUntil,
    user: updatedUser,
    verification: serializeVerification(updatedRow),
    sessionAction: decision === VERIFICATION_DECISION.AUTO_APPROVE
      ? 'sign_in_required'
      : undefined,
  };
}

export const PANEL_DEMO_PHONE = '09178888888';

function panelDemoEnabled() {
  return env.isDev && process.env.ENABLE_PANEL_DEMO === 'true';
}

/**
 * Panel roll step — force pass with whatever name/roll the presenter entered.
 */
async function panelAdvanceRoll({ user, fullName, rollNumber }) {
  const trimmedName = (fullName || user.name || 'Panel Demo Counsel').trim();
  const trimmedRoll = (rollNumber || 'DEMO').trim();
  const row = await ensureVerificationRow(user.id);
  const challenge = fmtCode();

  const updated = await prisma.lawyerVerification.update({
    where: { id: row.id },
    data: {
      submittedFullName: trimmedName,
      submittedRollNumber: trimmedRoll,
      rollMatchedName: trimmedName,
      rollMatchHit: true,
      challengeCode: challenge,
      challengeIssuedAt: new Date(),
      attempts: { increment: 1 },
      lastSubmittedAt: new Date(),
      decision: VERIFICATION_DECISION.PENDING,
      decisionReason: null,
      govIdOcrName: trimmedName,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lawyerVerificationStatus: VERIFICATION_STATUS.PENDING_UPLOAD,
      lawyerVerificationUpdatedAt: new Date(),
      barNumber: /^\d{4,6}$/.test(trimmedRoll) ? trimmedRoll : user.barNumber,
    },
  });

  return {
    ok: true,
    code: 'ROLL_MATCH',
    message: 'Panel demo: roll accepted. Continue to the next step.',
    challengeCode: challenge,
    challengeExpiresInHours: CHALLENGE_TTL_HOURS,
    verification: serializeVerification(updated),
  };
}

/**
 * Dev/panel: advance verification without real uploads.
 */
export async function panelAdvanceVerification({
  user,
  step,
  fullName,
  rollNumber,
  paymentAccountName,
}) {
  if (!panelDemoEnabled()) {
    const err = new Error('Not found');
    err.status = 404;
    throw err;
  }

  const stubBuf = Buffer.from(`panel-demo-${user.id}`);

  switch (step) {
    case 'roll':
      return panelAdvanceRoll({ user, fullName, rollNumber });
    case 'id':
      return attachGovernmentId({
        user,
        govIdUrl: 'panel://demo/gov-id',
        govIdType: 'PRC',
        govIdBuffer: stubBuf,
      });
    case 'selfie': {
      const row = await ensureVerificationRow(user.id);
      return attachSelfie({
        user,
        selfieUrl: 'panel://demo/selfie',
        selfieBuffer: stubBuf,
        govIdBuffer: stubBuf,
        reportedCode: row.challengeCode || '',
      });
    }
    case 'payment':
      return attachPaymentName({
        user,
        paymentAccountName: (paymentAccountName || user.name || 'Panel Demo').trim(),
      });
    case 'decide':
      return scoreAndDecide({
        user,
        providerOverrides: {
          faceProviderOverride: 'face-api.js',
          ocrProviderOverride: 'tesseract.js',
        },
      });
    default: {
      const err = new Error('Invalid panel step.');
      err.status = 400;
      throw err;
    }
  }
}

/**
 * Re-issue a fresh challenge code (e.g. after the previous one expired).
 */
export async function reissueChallenge({ user }) {
  const row = await ensureVerificationRow(user.id);
  const challenge = fmtCode();
  const updated = await prisma.lawyerVerification.update({
    where: { id: row.id },
    data: {
      challengeCode: challenge,
      challengeIssuedAt: new Date(),
      challengeCodeMatched: false,
    },
  });
  return {
    challengeCode: challenge,
    challengeExpiresInHours: CHALLENGE_TTL_HOURS,
    verification: serializeVerification(updated),
  };
}

/**
 * Get the current verification state (status + last decision + thresholds).
 */
export async function getVerificationState({ user }) {
  const row = await prisma.lawyerVerification.findUnique({
    where: { userId: user.id },
  });
  return {
    status: user.lawyerVerificationStatus || VERIFICATION_STATUS.NOT_STARTED,
    score: user.lawyerVerificationScore ?? null,
    rejectionReason: user.lawyerVerificationRejectionReason ?? null,
    cooldownUntil: user.lawyerVerificationCooldownUntil ?? null,
    thresholds: {
      high: HIGH_CONFIDENCE_THRESHOLD,
      medium: MEDIUM_CONFIDENCE_THRESHOLD,
    },
    verification: row ? serializeVerification(row) : null,
  };
}

export function serializeVerification(row) {
  if (!row) return null;
  return {
    id: row.id,
    submittedFullName: row.submittedFullName,
    submittedRollNumber: row.submittedRollNumber,
    rollMatchedName: row.rollMatchedName,
    rollMatchHit: row.rollMatchHit,
    govIdType: row.govIdType,
    govIdUrl: row.govIdUrl,
    govIdOcrName: row.govIdOcrName,
    govIdUploadedAt: row.govIdUploadedAt,
    challengeCode: row.challengeCode,
    challengeIssuedAt: row.challengeIssuedAt,
    selfieUrl: row.selfieUrl,
    selfieUploadedAt: row.selfieUploadedAt,
    faceMatchScore: row.faceMatchScore,
    ocrNameMatchScore: row.ocrNameMatchScore,
    paymentAccountName: row.paymentAccountName,
    paymentNameMatchScore: row.paymentNameMatchScore,
    challengeCodeMatched: row.challengeCodeMatched,
    aggregateConfidence: row.aggregateConfidence,
    decision: row.decision,
    decisionReason: row.decisionReason,
    decisionAt: row.decisionAt,
    attempts: row.attempts,
    lastSubmittedAt: row.lastSubmittedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const VERIFICATION_THRESHOLDS = {
  HIGH: HIGH_CONFIDENCE_THRESHOLD,
  MEDIUM: MEDIUM_CONFIDENCE_THRESHOLD,
  COOLDOWN_DAYS: COOLDOWN_DAYS_ON_REJECT,
};

/**
 * Admin manual approve — for NEEDS_REUPLOAD / PROCESSING edge cases.
 */
export async function adminApproveVerification({ userId, reason }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { lawyerVerification: true },
  });
  if (!user || user.role !== 'LAWYER') {
    const err = new Error('Lawyer not found.');
    err.status = 404;
    throw err;
  }

  const row = await ensureVerificationRow(userId);
  const updatedRow = await prisma.lawyerVerification.update({
    where: { id: row.id },
    data: {
      decision: VERIFICATION_DECISION.AUTO_APPROVE,
      decisionReason: reason || 'Approved by Ordinex admin review.',
      decisionAt: new Date(),
      aggregateConfidence: Math.max(row.aggregateConfidence || 0, HIGH_CONFIDENCE_THRESHOLD),
    },
  });

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      isVerified: true,
      lawyerVerificationStatus: VERIFICATION_STATUS.VERIFIED,
      lawyerVerificationScore: updatedRow.aggregateConfidence,
      lawyerVerificationRejectionReason: null,
      lawyerVerificationCooldownUntil: null,
      lawyerVerificationUpdatedAt: new Date(),
    },
  });

  sendLawyerVerifiedEmail(updatedUser).catch((err) => {
    console.error('[lawyerVerification] admin verified email failed:', err.message);
  });

  return { user: updatedUser, verification: serializeVerification(updatedRow) };
}

/**
 * Admin reject with reason + cooldown.
 */
export async function adminRejectVerification({ userId, reason }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== 'LAWYER') {
    const err = new Error('Lawyer not found.');
    err.status = 404;
    throw err;
  }

  const row = await ensureVerificationRow(userId);
  const cooldownUntil = new Date(Date.now() + COOLDOWN_DAYS_ON_REJECT * 24 * 60 * 60 * 1000);
  const msg = reason || 'Rejected by Ordinex admin review.';

  const updatedRow = await prisma.lawyerVerification.update({
    where: { id: row.id },
    data: {
      decision: VERIFICATION_DECISION.AUTO_REJECT,
      decisionReason: msg,
      decisionAt: new Date(),
    },
  });

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      isVerified: false,
      lawyerVerificationStatus: VERIFICATION_STATUS.REJECTED,
      lawyerVerificationRejectionReason: msg,
      lawyerVerificationCooldownUntil: cooldownUntil,
      lawyerVerificationUpdatedAt: new Date(),
    },
  });

  return { user: updatedUser, verification: serializeVerification(updatedRow) };
}

export async function listPendingVerifications({ limit = 50 } = {}) {
  return prisma.user.findMany({
    where: {
      role: 'LAWYER',
      lawyerVerificationStatus: { in: ['NEEDS_REUPLOAD', 'PROCESSING', 'PENDING_UPLOAD'] },
    },
    take: Math.min(100, limit),
    orderBy: { lawyerVerificationUpdatedAt: 'desc' },
    include: { lawyerVerification: true },
  }).then((users) => users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    barNumber: u.barNumber,
    isVerified: u.isVerified,
    lawyerVerificationStatus: u.lawyerVerificationStatus,
    lawyerVerificationScore: u.lawyerVerificationScore,
    lawyerVerificationUpdatedAt: u.lawyerVerificationUpdatedAt,
    lawyerVerification: serializeVerification(u.lawyerVerification),
  })));
}
