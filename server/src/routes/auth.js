// ============================================================
// Ordinex — Auth Routes
// Registration (with OTP), login, profile management.
// ============================================================
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../config/prisma.js';
import { generateToken, generateKycToken } from '../utils/jwt.js';
import { generateOTP } from '../utils/hash.js';
import { sendOTP, verifyOTP } from '../services/sms.js';
import {
  savePendingRegistration,
  getPendingRegistration,
  deletePendingRegistration,
} from '../services/pendingRegistration.js';
import { requireAuth } from '../middleware/auth.js';
import { requireLawyerKyc } from '../middleware/lawyerKycAuth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import {
  avatarUpload,
  credentialUpload,
  qrUpload,
  govIdUpload,
  selfieUpload,
  persistUploadedFile,
} from '../services/uploads.js';
import { normalizePhilippinePhone } from '../utils/phonePhilippines.js';
import {
  exchangeGoogleCode,
  getGoogleAuthUrl,
  isGoogleAuthConfigured,
} from '../services/googleAuth.js';
import {
  startVerification,
  attachGovernmentId,
  attachSelfie,
  attachPaymentName,
  scoreAndDecide,
  reissueChallenge,
  getVerificationState,
  serializeVerification,
  panelAdvanceVerification,
  VERIFICATION_STATUS,
  VERIFICATION_THRESHOLDS,
} from '../services/lawyerVerification.js';
import {
  sendCitizenWelcomeEmail,
  sendLawyerApplicationReceivedEmail,
} from '../services/email.js';
import { env } from '../config/env.js';

const router = Router();

function googlePlaceholderPhone(googleSub) {
  const h = crypto.createHash('sha256').update(googleSub).digest('hex').slice(0, 7);
  return `+6399${h.slice(0, 7)}`;
}

// ======================== REGISTER ========================

/**
 * POST /api/auth/register
 * Step 1: Validate fields, hash password, send OTP.
 * The account is NOT created until OTP is verified.
 */
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      role = 'CITIZEN',
      dob,
      gender,
      address,
      civilStatus,
      occupation,
      ...lawyerFields
    } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: 'Name, email, phone, and password are required.' });
    }

    if (role === 'CITIZEN') {
      if (!dob || !gender || !address || !civilStatus || !occupation) {
        return res.status(400).json({
          error: 'Date of birth, gender, address, civil status, and occupation are required for citizens.',
        });
      }
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const phoneClean = normalizePhilippinePhone(phone);
    if (!phoneClean) {
      return res.status(400).json({
        error: 'Enter a valid Philippine mobile number (9XX XXX XXXX after +63).',
      });
    }

    // Check if email or phone already exists
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: email.toLowerCase() }, { phone: phoneClean }],
      },
    });

    if (existing) {
      if (existing.email === email.toLowerCase()) {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }
      return res.status(409).json({ error: 'An account with this phone number already exists.' });
    }

    // Lawyers can register without an IBP/Roll number, but they
    // won't be marked Verified until they fill it in (and add at
    // least one credential proof) from their profile later.

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Public lawyers have zero fee no matter what they entered.
    const isPublicLawyer = role === 'LAWYER' && lawyerFields.practiceType === 'PUBLIC';
    const consultationFee = isPublicLawyer
      ? 0
      : lawyerFields.consultationFee
        ? parseFloat(lawyerFields.consultationFee)
        : null;

    await savePendingRegistration(phoneClean, {
      name,
      email: email.toLowerCase(),
      phone: phoneClean,
      passwordHash,
      role: role === 'LAWYER' ? 'LAWYER' : 'CITIZEN',
      barNumber: lawyerFields.barNumber || null,
      specializations: lawyerFields.specializations ? JSON.stringify(lawyerFields.specializations) : null,
      consultationFee,
      bio: lawyerFields.bio || null,
      yearsOfExperience: lawyerFields.yearsOfExperience ? parseInt(lawyerFields.yearsOfExperience) : null,
      practiceType: lawyerFields.practiceType || null,
      // Citizen expanded-profile fields
      dob: dob || null,
      gender: gender || null,
      address: address || null,
      civilStatus: civilStatus || null,
      occupation: occupation || null,
    });

    const otp = generateOTP();
    const sent = await sendOTP(phoneClean, otp, 'REGISTER');

    if (!sent) {
      return res.status(500).json({ error: 'Failed to send verification code. Please try again.' });
    }

    res.status(200).json({
      message: 'Verification code sent to your phone.',
      phone: phoneClean,
      // Dev mode: include OTP so frontend can auto-fill
      ...(process.env.NODE_ENV !== 'production' && { devOtp: otp }),
    });
  } catch (error) {
    next(error);
  }
});

// ======================== VERIFY OTP ========================

/**
 * POST /api/auth/verify-otp
 * Step 2: Verify OTP → create the user account → return JWT.
 */
router.post('/verify-otp', authLimiter, async (req, res, next) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ error: 'Phone and verification code are required.' });
    }

    const phoneClean = normalizePhilippinePhone(phone);
    if (!phoneClean) {
      return res.status(400).json({ error: 'Invalid phone number.' });
    }

    const panelDemo = req.get('X-Panel-Demo') === '1';
    const result = await verifyOTP(phoneClean, code, 'REGISTER', { panelDemo });
    if (!result.valid) {
      return res.status(400).json({ error: result.error });
    }

    const pendingData = await getPendingRegistration(phoneClean);
    if (!pendingData) {
      return res.status(400).json({ error: 'Registration data expired. Please register again.' });
    }

    const user = await prisma.user.create({
      data: {
        ...pendingData,
        isVerified: false,
      },
    });

    await deletePendingRegistration(phoneClean);

    if (pendingData.role === 'LAWYER') {
      const kycToken = generateKycToken(user.id);
      sendLawyerApplicationReceivedEmail(user).catch((err) => {
        console.error('[auth] lawyer application email failed:', err.message);
      });
      return res.status(201).json({
        message: 'Account created. Complete identity verification to activate counsel access.',
        kycToken,
        kycRequired: true,
        user: sanitizeUser(user),
      });
    }

    sendCitizenWelcomeEmail(user).catch((err) => {
      console.error('[auth] welcome email failed:', err.message);
    });

    const token = generateToken(user);

    res.status(201).json({
      message: 'Account created successfully!',
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/resend-otp
 * Body: { phone, purpose?: 'REGISTER' | 'RESET_PASSWORD' }
 */
router.post('/resend-otp', authLimiter, async (req, res, next) => {
  try {
    const { phone, purpose = 'REGISTER' } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }

    const phoneClean = normalizePhilippinePhone(phone);
    if (!phoneClean) {
      return res.status(400).json({ error: 'Invalid phone number.' });
    }

    if (purpose === 'REGISTER') {
      const pending = await getPendingRegistration(phoneClean);
      if (!pending) {
        return res.status(400).json({ error: 'Registration expired. Please sign up again.' });
      }
    } else if (purpose === 'RESET_PASSWORD') {
      const user = await prisma.user.findUnique({ where: { phone: phoneClean } });
      if (!user) {
        return res.json({ message: 'If an account exists, a new code has been sent.' });
      }
    } else {
      return res.status(400).json({ error: 'Invalid purpose.' });
    }

    const otp = generateOTP();
    const sent = await sendOTP(phoneClean, otp, purpose);
    if (!sent) {
      return res.status(500).json({ error: 'Failed to send verification code.' });
    }

    res.json({
      message: 'Verification code sent.',
      phone: phoneClean,
      ...(process.env.NODE_ENV !== 'production' && { devOtp: otp }),
    });
  } catch (error) {
    next(error);
  }
});

// ======================== LOGIN ========================

/**
 * POST /api/auth/login
 * Email + password → JWT token.
 */
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const password = (req.body.password || '').trim();

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { subscription: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.isBanned) {
      return res.status(403).json({ error: 'Your account has been suspended.' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.role === 'LAWYER' && !user.isVerified) {
      return res.status(403).json({
        error: 'Your counsel account is not verified yet. Complete your application at /lawyer/register or wait for the approval email.',
        code: 'LAWYER_PENDING_VERIFICATION',
      });
    }

    // Check subscription expiry
    if (user.isPremium && user.subscription) {
      if (new Date(user.subscription.endDate) < new Date()) {
        await prisma.$transaction([
          prisma.user.update({ where: { id: user.id }, data: { isPremium: false } }),
          prisma.subscription.update({ where: { id: user.subscription.id }, data: { status: 'EXPIRED' } }),
        ]);
        user.isPremium = false;
      }
    }

    const token = generateToken(user);

    // Update isFirstLogin on first login
    if (user.isFirstLogin) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isFirstLogin: false },
      });
    }

    res.json({
      message: 'Login successful.',
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
});

// ======================== FORGOT PASSWORD ========================

/**
 * POST /api/auth/forgot-password
 * Send OTP to phone for password reset.
 */
router.post('/forgot-password', authLimiter, async (req, res, next) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }

    const phoneClean = normalizePhilippinePhone(phone);
    if (!phoneClean) {
      return res.status(400).json({ error: 'Invalid Philippine phone number.' });
    }

    const user = await prisma.user.findUnique({ where: { phone: phoneClean } });

    if (!user) {
      return res.json({ message: 'If an account exists with this phone, a verification code has been sent.' });
    }

    const otp = generateOTP();
    const sent = await sendOTP(phoneClean, otp, 'RESET_PASSWORD');
    if (!sent) {
      return res.status(500).json({ error: 'Failed to send verification code. Please try again.' });
    }

    res.json({
      message: 'If an account exists with this phone, a verification code has been sent.',
      ...(process.env.NODE_ENV !== 'production' && { devOtp: otp }),
    });
  } catch (error) {
    next(error);
  }
});

// ======================== RESET PASSWORD ========================

/**
 * POST /api/auth/reset-password
 * OTP + new password → update password.
 */
router.post('/reset-password', authLimiter, async (req, res, next) => {
  try {
    const { phone, code, newPassword } = req.body;

    if (!phone || !code || !newPassword) {
      return res.status(400).json({ error: 'Phone, code, and new password are required.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const phoneClean = normalizePhilippinePhone(phone);
    if (!phoneClean) {
      return res.status(400).json({ error: 'Invalid phone number.' });
    }

    const result = await verifyOTP(phoneClean, code, 'RESET_PASSWORD');
    if (!result.valid) {
      return res.status(400).json({ error: result.error });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { phone: phoneClean },
      data: { passwordHash },
    });

    res.json({ message: 'Password reset successfully. You can now sign in.' });
  } catch (error) {
    next(error);
  }
});

// ======================== GET PROFILE ========================

/**
 * GET /api/auth/me
 * Returns the authenticated user's profile.
 */
router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

// ======================== UPDATE PROFILE ========================

/**
 * PATCH /api/auth/me
 * Update user profile fields.
 */
router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const allowedFields = ['name', 'language', 'bio', 'avatarUrl', 'isFirstLogin'];

    // Citizens can also update their expanded-profile fields
    if (req.user.role === 'CITIZEN') {
      allowedFields.push('dob', 'gender', 'address', 'civilStatus', 'occupation');
    }

    // Lawyers can also update these
    if (req.user.role === 'LAWYER') {
      allowedFields.push(
        'barNumber',
        'specializations',
        'consultationFee',
        'consultationFeeMin',
        'consultationFeeMax',
        'acceptingBookings',
        'practiceType',
        'paymentMethods',
        'credentials'
      );
    }

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update.' });
    }

    // Stringify JSON fields
    if (updates.specializations && typeof updates.specializations !== 'string') {
      updates.specializations = JSON.stringify(updates.specializations);
    }
    if (updates.paymentMethods && typeof updates.paymentMethods !== 'string') {
      updates.paymentMethods = JSON.stringify(updates.paymentMethods);
    }
    if (updates.credentials && typeof updates.credentials !== 'string') {
      updates.credentials = JSON.stringify(updates.credentials);
    }
    if (updates.consultationFee !== undefined) {
      updates.consultationFee = parseFloat(updates.consultationFee);
    }
    if (updates.consultationFeeMin !== undefined) {
      updates.consultationFeeMin = parseFloat(updates.consultationFeeMin);
    }
    if (updates.consultationFeeMax !== undefined) {
      updates.consultationFeeMax = parseFloat(updates.consultationFeeMax);
    }
    if (updates.acceptingBookings !== undefined) {
      updates.acceptingBookings = Boolean(updates.acceptingBookings);
    }

    const effectivePracticeType = updates.practiceType ?? req.user.practiceType;
    if (req.user.role === 'LAWYER') {
      const min = updates.consultationFeeMin ?? req.user.consultationFeeMin ?? updates.consultationFee ?? req.user.consultationFee;
      const max = updates.consultationFeeMax ?? req.user.consultationFeeMax ?? min;
      if (min != null && max != null && min > max) {
        return res.status(400).json({ error: 'Minimum fee cannot exceed maximum fee.' });
      }
      if (updates.consultationFeeMin != null || updates.consultationFeeMax != null || updates.consultationFee != null) {
        const resolvedMin = updates.consultationFeeMin ?? req.user.consultationFeeMin ?? min ?? 0;
        const resolvedMax = updates.consultationFeeMax ?? req.user.consultationFeeMax ?? resolvedMin;
        updates.consultationFee = resolvedMin;
        updates.consultationFeeMin = resolvedMin;
        updates.consultationFeeMax = Math.max(resolvedMin, resolvedMax);
      }
    }

    // Recompute verification status for lawyers based on the new state.
    if (req.user.role === 'LAWYER') {
      const merged = { ...req.user, ...updates };
      updates.isVerified = computeLawyerVerified(merged);
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updates,
      include: { subscription: true },
    });

    res.json({ message: 'Profile updated.', user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

// ======================== AVATAR UPLOAD ========================

/**
 * POST /api/auth/me/avatar
 * Multipart upload (field name: "avatar"). Replaces the user's avatarUrl.
 */
/**
 * POST /api/auth/me/payment-qr
 * Upload a QR image for payment methods (lawyers only).
 */
router.post('/me/payment-qr', requireAuth, qrUpload.single('qr'), async (req, res, next) => {
  try {
    if (req.user.role !== 'LAWYER') {
      return res.status(403).json({ error: 'Only lawyers can upload payment QR codes.' });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    const url = await persistUploadedFile(req.file, 'payments');
    res.json({ message: 'QR uploaded.', qrUrl: url });
  } catch (error) {
    next(error);
  }
});

router.post('/me/avatar', requireAuth, avatarUpload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    const url = await persistUploadedFile(req.file, 'avatars');
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatarUrl: url },
      include: { subscription: true },
    });
    res.json({ message: 'Avatar updated.', avatarUrl: url, user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

// ======================== CREDENTIALS (Lawyer) ========================

/**
 * POST /api/auth/me/credentials
 * Multipart upload (field name: "file") + form fields: title, description.
 * Appends a new credential to the lawyer's credentials JSON array
 * and recomputes their isVerified status.
 */
router.post('/me/credentials', requireAuth, credentialUpload.single('file'), async (req, res, next) => {
  try {
    if (req.user.role !== 'LAWYER') {
      return res.status(403).json({ error: 'Only lawyers can upload credentials.' });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    const { title, description = '' } = req.body;
    if (!title || title.trim().length < 2) {
      return res.status(400).json({ error: 'Credential title is required.' });
    }

    const fileUrl = await persistUploadedFile(req.file, 'credentials');

    let creds = [];
    if (req.user.credentials) {
      try { creds = JSON.parse(req.user.credentials); } catch { creds = []; }
      if (!Array.isArray(creds)) creds = [];
    }
    creds.push({
      id: crypto.randomUUID(),
      title: title.trim(),
      description: description.trim(),
      fileUrl,
      uploadedAt: new Date().toISOString(),
    });

    const merged = { ...req.user, credentials: creds };
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        credentials: JSON.stringify(creds),
        isVerified: computeLawyerVerified(merged),
      },
      include: { subscription: true },
    });

    res.status(201).json({ message: 'Credential added.', user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/auth/me/credentials/:credId
 * Remove a credential from the lawyer's profile.
 */
router.delete('/me/credentials/:credId', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'LAWYER') {
      return res.status(403).json({ error: 'Only lawyers can manage credentials.' });
    }
    let creds = [];
    if (req.user.credentials) {
      try { creds = JSON.parse(req.user.credentials); } catch { creds = []; }
    }
    const filtered = creds.filter((c) => c.id !== req.params.credId);
    if (filtered.length === creds.length) {
      return res.status(404).json({ error: 'Credential not found.' });
    }

    const merged = { ...req.user, credentials: filtered };
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        credentials: JSON.stringify(filtered),
        isVerified: computeLawyerVerified(merged),
      },
      include: { subscription: true },
    });

    res.json({ message: 'Credential removed.', user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

// ======================== GOOGLE OAUTH ========================

router.get('/google/status', (_req, res) => {
  res.json({ enabled: isGoogleAuthConfigured() });
});

router.get('/google/start', (req, res) => {
  if (!isGoogleAuthConfigured()) {
    return res.status(503).json({ error: 'Google sign-in is not configured.' });
  }
  const role = req.query.role === 'LAWYER' ? 'LAWYER' : 'CITIZEN';
  const state = Buffer.from(JSON.stringify({ role, n: crypto.randomBytes(8).toString('hex') })).toString('base64url');
  res.redirect(getGoogleAuthUrl(state));
});

router.get('/google/callback', async (req, res, next) => {
  try {
    if (!isGoogleAuthConfigured()) {
      return res.redirect(`${env.FRONTEND_URL}/?authError=google_not_configured`);
    }
    const { code, state } = req.query;
    if (!code || typeof code !== 'string') {
      return res.redirect(`${env.FRONTEND_URL}/?authError=missing_code`);
    }
    let role = 'CITIZEN';
    try {
      if (state && typeof state === 'string') {
        const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
        if (parsed.role === 'LAWYER') role = 'LAWYER';
      }
    } catch { /* default citizen */ }

    const profile = await exchangeGoogleCode(code);
    const googleId = profile.sub;
    const email = (profile.email || '').toLowerCase();
    const name = profile.name || profile.given_name || 'Google User';

    if (!email) {
      return res.redirect(`${env.FRONTEND_URL}/?authError=no_email`);
    }

    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
    });

    let needsLawyerOnboard = false;

    if (!user) {
      let phone = googlePlaceholderPhone(googleId);
      for (let attempt = 0; attempt < 5; attempt++) {
        const clash = await prisma.user.findUnique({ where: { phone } });
        if (!clash) break;
        phone = googlePlaceholderPhone(`${googleId}${attempt}`);
      }
      const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
      user = await prisma.user.create({
        data: {
          name,
          email,
          phone,
          passwordHash,
          googleId,
          role,
        },
      });
      needsLawyerOnboard = role === 'LAWYER';
    } else {
      if (user.isBanned) {
        return res.redirect(`${env.FRONTEND_URL}/?authError=account_suspended`);
      }
      if (user.role !== role) {
        return res.redirect(`${env.FRONTEND_URL}/?authError=role_mismatch`);
      }
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId },
        });
      }
      if (user.role === 'LAWYER' && !user.barNumber) {
        needsLawyerOnboard = true;
      }
    }

    const token = generateToken(user);
    const doneBase = `${env.FRONTEND_URL.replace(/\/$/, '')}/auth/google/done?token=${encodeURIComponent(token)}`;
    const front = needsLawyerOnboard ? `${doneBase}&onboard=lawyer` : doneBase;
    res.redirect(front);
  } catch (error) {
    console.error('[auth/google/callback] failed:', error?.message || error);
    return res.redirect(`${env.FRONTEND_URL}/?authError=google_failed`);
  }
});

// ======================== HELPERS ========================

/**
 * Lawyer is verified ONLY via KYC (AUTO_APPROVE or admin approve).
 * Legacy "bar number + any credential" shortcut is removed.
 */
export function computeLawyerVerified(lawyer) {
  if (!lawyer || lawyer.role !== 'LAWYER') return false;
  return lawyer.lawyerVerificationStatus === 'VERIFIED';
}

/**
 * Remove sensitive fields from user object before sending to client.
 */
function sanitizeUser(user) {
  const { passwordHash, lawyerVerification, ...safeUser } = user;

  if (safeUser.specializations) {
    try { safeUser.specializations = JSON.parse(safeUser.specializations); } catch {}
  }
  if (safeUser.paymentMethods) {
    try { safeUser.paymentMethods = JSON.parse(safeUser.paymentMethods); } catch {}
  }
  if (safeUser.credentials) {
    try { safeUser.credentials = JSON.parse(safeUser.credentials); } catch {}
  }

  if (lawyerVerification) {
    safeUser.lawyerVerification = serializeVerification(lawyerVerification);
  }

  return safeUser;
}

// ======================== LAWYER VERIFICATION (KYC) ========================

function lawyerOnly(req, res) {
  if (req.user.role !== 'LAWYER') {
    res.status(403).json({ error: 'Only lawyers can use the verification flow.' });
    return false;
  }
  return true;
}

/**
 * GET /api/auth/me/lawyer-verification
 * Returns current verification state for the authenticated lawyer.
 */
router.get('/me/lawyer-verification', requireLawyerKyc, async (req, res, next) => {
  try {
    if (!lawyerOnly(req, res)) return;
    const state = await getVerificationState({ user: req.user });
    res.json({
      thresholds: VERIFICATION_THRESHOLDS,
      ...state,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/me/lawyer-verification/start
 * Body: { fullName, rollNumber }
 * Step 1 — cross-reference the SC Roll seed and issue a challenge code.
 */
router.post('/me/lawyer-verification/start', requireLawyerKyc, async (req, res, next) => {
  try {
    if (!lawyerOnly(req, res)) return;
    const { fullName, rollNumber } = req.body || {};
    const out = await startVerification({
      user: req.user,
      fullName,
      rollNumber,
    });
    res.json(out);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/me/lawyer-verification/reissue
 * Issues a fresh handwritten-challenge code (replaces the previous one).
 */
router.post('/me/lawyer-verification/reissue', requireLawyerKyc, async (req, res, next) => {
  try {
    if (!lawyerOnly(req, res)) return;
    const out = await reissueChallenge({ user: req.user });
    res.json(out);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/me/lawyer-verification/id
 * Multipart: field "idImage", form fields: govIdType (PRC|IBP_ID|DRIVER|PASSPORT|...).
 */
router.post(
  '/me/lawyer-verification/id',
  requireLawyerKyc,
  govIdUpload.single('idImage'),
  async (req, res, next) => {
    try {
      if (!lawyerOnly(req, res)) return;
      if (!req.file) return res.status(400).json({ error: 'No ID image uploaded.' });
      const { govIdType = 'PRC' } = req.body || {};
      const govIdUrl = await persistUploadedFile(req.file, 'verification');
      const out = await attachGovernmentId({
        user: req.user,
        govIdUrl,
        govIdType,
        govIdBuffer: req.file.buffer,
      });
      res.json(out);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/auth/me/lawyer-verification/selfie
 * Multipart: field "selfieImage", form fields: reportedCode (handwritten note).
 */
router.post(
  '/me/lawyer-verification/selfie',
  requireLawyerKyc,
  selfieUpload.single('selfieImage'),
  async (req, res, next) => {
    try {
      if (!lawyerOnly(req, res)) return;
      if (!req.file) return res.status(400).json({ error: 'No selfie image uploaded.' });
      const { reportedCode } = req.body || {};
      const selfieUrl = await persistUploadedFile(req.file, 'verification');

      // The current ID image is referenced in the user's verification row;
      // we don't refetch its bytes here — the face matcher tolerates this.
      const out = await attachSelfie({
        user: req.user,
        selfieUrl,
        selfieBuffer: req.file.buffer,
        govIdBuffer: null,
        reportedCode,
      });
      res.json(out);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/auth/me/lawyer-verification/payment
 * Body: { paymentAccountName }
 */
router.post('/me/lawyer-verification/payment', requireLawyerKyc, async (req, res, next) => {
  try {
    if (!lawyerOnly(req, res)) return;
    const { paymentAccountName } = req.body || {};
    if (!paymentAccountName) {
      return res.status(400).json({ error: 'paymentAccountName is required.' });
    }
    const out = await attachPaymentName({
      user: req.user,
      paymentAccountName,
    });
    res.json(out);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/me/lawyer-verification/decide
 * Runs the scoring engine and returns the final decision.
 */
router.post('/me/lawyer-verification/decide', requireLawyerKyc, async (req, res, next) => {
  try {
    if (!lawyerOnly(req, res)) return;
    const out = await scoreAndDecide({ user: req.user });
    const refreshed = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { subscription: true, lawyerVerification: true },
    });
    res.json({
      ...out,
      user: sanitizeUser(refreshed),
      verification: serializeVerification(refreshed.lawyerVerification),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/me/lawyer-verification/panel-advance
 * Dev/panel only — stub KYC steps without real uploads.
 * Requires NODE_ENV=development AND ENABLE_PANEL_DEMO=true.
 */
router.post('/me/lawyer-verification/panel-advance', requireLawyerKyc, async (req, res, next) => {
  try {
    if (!lawyerOnly(req, res)) return;
    if (!(env.isDev && process.env.ENABLE_PANEL_DEMO === 'true')) {
      return res.status(404).json({ error: 'Not found.' });
    }
    const { step, fullName, rollNumber, paymentAccountName } = req.body || {};
    if (!step) {
      return res.status(400).json({ error: 'step is required.' });
    }
    const out = await panelAdvanceVerification({
      user: req.user,
      step,
      fullName,
      rollNumber,
      paymentAccountName,
    });
    const refreshed = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { subscription: true, lawyerVerification: true },
    });
    res.json({
      ...out,
      user: sanitizeUser(refreshed),
      verification: serializeVerification(refreshed?.lawyerVerification),
    });
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: 'Not found.' });
    next(err);
  }
});

export default router;
