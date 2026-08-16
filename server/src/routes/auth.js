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
  getPendingRegistrationByEmail,
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
  reclaimIncompleteMatches,
  reclaimIfIncomplete,
  incompleteSignupInclude,
} from '../services/incompleteSignup.js';
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
  sendEmailOTP,
} from '../services/email.js';
import { extractCitizenIdData } from '../services/ocrService.js';
import { compareFaces } from '../services/faceMatchService.js';
import { nameSimilarity } from '../utils/stringDistance.js';
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
      firstName,
      middleName,
      lastName,
      suffix,
      aliases,
      email,
      phone,
      password,
      role = 'CITIZEN',
      // Demographics & legal capacity
      dob,
      gender,
      citizenship,
      civilStatus,
      occupation,
      indigencyTier,
      // PSGC address fields
      region,
      province,
      city,
      barangay,
      streetAddress,
      zipCode,
      address,
      // Identification & emergency contact
      citizenIdType,
      citizenIdNumber,
      emergencyContactName,
      emergencyContactPhone,
      emergencyRelationship,
      // Security question & answer
      securityQuestion,
      securityAnswer,
      ...lawyerFields
    } = req.body;

    // Compute legal name if first & last name provided
    let legalFullName = (name || '').trim();
    if (!legalFullName && (firstName || lastName)) {
      const parts = [firstName?.trim(), middleName?.trim(), lastName?.trim(), suffix?.trim()].filter(Boolean);
      legalFullName = parts.join(' ');
    }

    // Validate required fields
    if (!legalFullName || !email || !phone || !password) {
      return res.status(400).json({ error: 'Name, email, phone, and password are required.' });
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

    const emailClean = email.toLowerCase();
    const { blocked } = await reclaimIncompleteMatches({ email: emailClean, phone: phoneClean });
    if (blocked) {
      if (blocked.email === emailClean) {
        return res.status(409).json({ error: 'An account with this email already exists. Log in instead.' });
      }
      return res.status(409).json({ error: 'An account with this phone number already exists. Log in instead.' });
    }

    // Hash password and security answer
    const passwordHash = await bcrypt.hash(password, 12);
    let securityAnswerHash = null;
    if (securityAnswer && securityAnswer.trim()) {
      securityAnswerHash = await bcrypt.hash(securityAnswer.trim().toLowerCase(), 10);
    }

    // Public lawyers have zero fee no matter what they entered.
    const isPublicLawyer = role === 'LAWYER' && lawyerFields.practiceType === 'PUBLIC';
    const consultationFee = isPublicLawyer
      ? 0
      : lawyerFields.consultationFee
        ? parseFloat(lawyerFields.consultationFee)
        : null;

    // Computed formatted address
    const fullAddress = address || [streetAddress, barangay ? `Brgy. ${barangay}` : '', city, province, zipCode].filter(Boolean).join(', ') || null;

    await savePendingRegistration(phoneClean, {
      name: legalFullName,
      firstName: firstName?.trim() || null,
      middleName: middleName?.trim() || null,
      lastName: lastName?.trim() || null,
      suffix: suffix?.trim() || null,
      aliases: aliases?.trim() || null,
      email: email.toLowerCase(),
      phone: phoneClean,
      passwordHash,
      role: role === 'LAWYER' ? 'LAWYER' : 'CITIZEN',
      barNumber: lawyerFields.barNumber || null,
      barAdmissionYear: lawyerFields.barAdmissionYear ? parseInt(lawyerFields.barAdmissionYear) : null,
      ibpChapter: lawyerFields.ibpChapter || null,
      ibpIdNumber: lawyerFields.ibpIdNumber || null,
      mcleComplianceNo: lawyerFields.mcleComplianceNo || null,
      lawFirmName: lawyerFields.lawFirmName || null,
      specializations: lawyerFields.specializations ? JSON.stringify(lawyerFields.specializations) : null,
      consultationFee,
      bio: lawyerFields.bio || null,
      yearsOfExperience: lawyerFields.yearsOfExperience ? parseInt(lawyerFields.yearsOfExperience) : null,
      practiceType: lawyerFields.practiceType || null,
      // Citizen expanded-profile fields
      dob: dob || null,
      gender: gender || null,
      citizenship: citizenship || 'Filipino',
      civilStatus: civilStatus || null,
      occupation: occupation || null,
      indigencyTier: indigencyTier || 'STANDARD',
      // Structured PSGC address
      region: region || null,
      province: province || null,
      city: city || null,
      barangay: barangay || null,
      streetAddress: streetAddress || null,
      zipCode: zipCode || null,
      address: fullAddress,
      // ID & emergency
      citizenIdType: citizenIdType || null,
      citizenIdNumber: citizenIdNumber || null,
      emergencyContactName: emergencyContactName || null,
      emergencyContactPhone: emergencyContactPhone || null,
      emergencyRelationship: emergencyRelationship || null,
      // Security question for 2-factor password reset
      securityQuestion: securityQuestion?.trim() || null,
      securityAnswerHash,
    });

    const otp = generateOTP();
    try {
      await sendOTP(phoneClean, otp, 'REGISTER');
      await sendOTP(email.toLowerCase(), otp, 'REGISTER');
    } catch (smsErr) {
      console.warn('[auth] sendOTP warning:', smsErr?.message);
    }
    if (email) {
      try {
        await sendEmailOTP({ to: emailClean, code: otp, purpose: 'REGISTER' });
      } catch (emailErr) {
        console.warn('[auth] sendEmailOTP warning:', emailErr?.message);
      }
    }

    res.status(200).json({
      message: 'Verification code sent to your email and phone.',
      phone: phoneClean,
      email: email.toLowerCase(),
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
 * Verify OTP by phone or email, then create the user account.
 */
router.post('/verify-otp', authLimiter, async (req, res, next) => {
  try {
    const { phone, email, code } = req.body;

    if ((!phone && !email) || !code) {
      return res.status(400).json({ error: 'Email or phone and verification code are required.' });
    }

    let phoneClean = phone ? normalizePhilippinePhone(phone) : null;
    let verifyKey = phoneClean || (email || '').trim().toLowerCase();

    if (email && !phoneClean) {
      const pendingByEmail = await getPendingRegistrationByEmail(email);
      if (pendingByEmail) {
        phoneClean = pendingByEmail.phone;
        verifyKey = email.trim().toLowerCase();
      }
    }

    if (!verifyKey) {
      return res.status(400).json({ error: 'Invalid phone number or email.' });
    }

    const panelDemo = req.get('X-Panel-Demo') === '1';
    const result = await verifyOTP(verifyKey, code, 'REGISTER', { panelDemo });
    if (!result.valid) {
      return res.status(400).json({ error: result.error });
    }

    if (!phoneClean && email) {
      const pendingByEmail = await getPendingRegistrationByEmail(email);
      phoneClean = pendingByEmail?.phone || null;
    }

    const pendingData = phoneClean ? await getPendingRegistration(phoneClean) : null;
    if (!pendingData) {
      return res.status(400).json({ error: 'Registration data expired. Please register again.' });
    }

    const user = await prisma.user.create({
      data: {
        ...pendingData,
        isVerified: false,
        emailVerified: true,
      },
    });

    await deletePendingRegistration(phoneClean);

    const token = generateToken(user);

    if (pendingData.role === 'LAWYER') {
      const kycToken = generateKycToken(user.id);
      return res.status(201).json({
        message: 'Account created. Complete identity verification to activate counsel access.',
        token,
        kycToken,
        kycRequired: true,
        user: sanitizeUser(user),
      });
    }

    sendCitizenWelcomeEmail(user).catch((err) => {
      console.error('[auth] welcome email failed:', err.message);
    });

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
 * Body: { email?: string, phone?: string, purpose?: 'REGISTER' | 'RESET_PASSWORD' }
 */
router.post('/resend-otp', authLimiter, async (req, res, next) => {
  try {
    const emailInput = (req.body.email || '').trim().toLowerCase();
    const phoneInput = (req.body.phone || '').trim();
    const purpose = req.body.purpose || 'REGISTER';

    let targetIdentifier = '';
    let targetEmail = '';

    if (purpose === 'RESET_PASSWORD') {
      if (emailInput) {
        const user = await prisma.user.findUnique({ where: { email: emailInput } });
        if (!user) {
          return res.json({ message: 'If an account exists, a new code has been sent.' });
        }
        targetIdentifier = emailInput;
        targetEmail = emailInput;
      } else if (phoneInput) {
        const phoneClean = normalizePhilippinePhone(phoneInput);
        if (!phoneClean) return res.status(400).json({ error: 'Invalid phone number.' });
        const user = await prisma.user.findUnique({ where: { phone: phoneClean } });
        if (!user) {
          return res.json({ message: 'If an account exists, a new code has been sent.' });
        }
        targetIdentifier = phoneClean;
        targetEmail = user.email;
      } else {
        return res.status(400).json({ error: 'Email or phone number is required.' });
      }
    } else if (purpose === 'REGISTER') {
      if (!phoneInput) {
        return res.status(400).json({ error: 'Phone number is required.' });
      }
      const phoneClean = normalizePhilippinePhone(phoneInput);
      if (!phoneClean) {
        return res.status(400).json({ error: 'Invalid phone number.' });
      }
      const pending = await getPendingRegistration(phoneClean);
      if (!pending) {
        return res.status(400).json({ error: 'Registration expired. Please sign up again.' });
      }
      targetIdentifier = phoneClean;
      targetEmail = pending.email;
    } else {
      return res.status(400).json({ error: 'Invalid purpose.' });
    }

    const otp = generateOTP();
    try {
      await sendOTP(targetIdentifier, otp, purpose);
    } catch (smsErr) {
      console.warn('[auth] resend sendOTP warning:', smsErr?.message);
    }
    if (targetEmail) {
      try {
        await sendEmailOTP({ to: targetEmail, code: otp, purpose });
      } catch (emailErr) {
        console.warn('[auth] resend sendEmailOTP warning:', emailErr?.message);
      }
    }

    res.json({
      message: 'Verification code sent to your email.',
      email: targetEmail,
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

    if (user.suspensionUntil && new Date(user.suspensionUntil) > new Date()) {
      return res.status(403).json({
        error: `Your account is temporarily restricted until ${new Date(user.suspensionUntil).toLocaleDateString()}. Reason: ${user.suspensionReason || 'Policy violation'}.`,
        code: 'ACCOUNT_SUSPENDED',
      });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
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

async function resolveUserByEmailOrPhone(emailInput, phoneInput) {
  if (emailInput) {
    const user = await prisma.user.findUnique({ where: { email: emailInput } });
    return { user, targetIdentifier: emailInput, targetEmail: emailInput };
  }
  if (phoneInput) {
    const phoneClean = normalizePhilippinePhone(phoneInput);
    if (!phoneClean) return { user: null, targetIdentifier: '', targetEmail: '' };
    const user = await prisma.user.findUnique({ where: { phone: phoneClean } });
    return { user, targetIdentifier: phoneClean, targetEmail: user?.email || '' };
  }
  return { user: null, targetIdentifier: '', targetEmail: '' };
}

async function dispatchResetOtp(targetIdentifier, targetEmail) {
  const otp = generateOTP();
  if (targetIdentifier) {
    await sendOTP(targetIdentifier, otp, 'RESET_PASSWORD');
  }
  if (targetEmail) {
    await sendEmailOTP({ to: targetEmail, code: otp, purpose: 'RESET_PASSWORD' });
  }
  return otp;
}

/**
 * POST /api/auth/forgot-password
 * Step 1: Registered email only — send a 6-digit code. 400 if unknown.
 */
router.post('/forgot-password', authLimiter, async (req, res, next) => {
  try {
    const emailInput = (req.body.email || '').trim().toLowerCase();
    const phoneInput = (req.body.phone || '').trim();

    if (!emailInput && !phoneInput) {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    const { user, targetIdentifier, targetEmail } = await resolveUserByEmailOrPhone(emailInput, phoneInput);
    if (!user) {
      return res.status(400).json({ error: 'No Ordinex account uses this email. Check the address and try again.' });
    }

    const otp = await dispatchResetOtp(targetIdentifier, targetEmail);

    res.json({
      message: 'A 6-digit verification code has been sent to your email.',
      hasSecurityQuestion: Boolean(user.securityAnswerHash),
      requiresSecurityAnswer: Boolean(user.securityAnswerHash),
      ...(process.env.NODE_ENV !== 'production' && { devOtp: otp }),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/forgot-password/verify-security
 * After email code: check the security answer. Does not send another OTP.
 */
router.post('/forgot-password/verify-security', authLimiter, async (req, res, next) => {
  try {
    const emailInput = (req.body.email || '').trim().toLowerCase();
    const phoneInput = (req.body.phone || '').trim();
    const securityAnswer = (req.body.securityAnswer || '').trim();

    if (!securityAnswer) {
      return res.status(400).json({ error: 'Please answer your security question.' });
    }

    const { user } = await resolveUserByEmailOrPhone(emailInput, phoneInput);
    if (!user) {
      return res.status(400).json({ error: 'Incorrect answer. Please try again.' });
    }
    if (!user.securityAnswerHash) {
      return res.status(400).json({ error: 'No security question on this account.' });
    }

    const answerMatch = await bcrypt.compare(securityAnswer.toLowerCase(), user.securityAnswerHash);
    if (!answerMatch) {
      return res.status(400).json({ error: 'Incorrect answer to security question.' });
    }

    res.json({
      message: 'Security answer verified. You can set a new password.',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/forgot-password/send-code
 * Step 2b: For accounts without a security question — send OTP directly.
 */
router.post('/forgot-password/send-code', authLimiter, async (req, res, next) => {
  try {
    const emailInput = (req.body.email || '').trim().toLowerCase();
    const phoneInput = (req.body.phone || '').trim();

    const { user, targetIdentifier, targetEmail } = await resolveUserByEmailOrPhone(emailInput, phoneInput);

    let otp = null;
    if (user) {
      otp = await dispatchResetOtp(targetIdentifier, targetEmail);
    }

    res.json({
      message: 'If an account exists, a 6-digit verification code has been sent to your email.',
      ...(process.env.NODE_ENV !== 'production' && otp && { devOtp: otp }),
    });
  } catch (error) {
    next(error);
  }
});

// ======================== VERIFY RESET CODE ========================

/**
 * POST /api/auth/verify-reset-code
 * Check if the 6-digit OTP code from email is valid before advancing to the security question.
 */
router.post('/verify-reset-code', authLimiter, async (req, res, next) => {
  try {
    const emailInput = (req.body.email || '').trim().toLowerCase();
    const phoneInput = (req.body.phone || '').trim();
    const code = (req.body.code || '').trim();

    if ((!emailInput && !phoneInput) || !code) {
      return res.status(400).json({ error: 'Email and verification code are required.' });
    }

    let user = null;
    let targetIdentifier = '';

    if (emailInput) {
      user = await prisma.user.findUnique({ where: { email: emailInput } });
      targetIdentifier = emailInput;
    } else if (phoneInput) {
      const phoneClean = normalizePhilippinePhone(phoneInput);
      if (phoneClean) {
        user = await prisma.user.findUnique({ where: { phone: phoneClean } });
        targetIdentifier = phoneClean;
      }
    }

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification code.' });
    }

    const challenge = await prisma.otpChallenge.findUnique({
      where: { phone_purpose: { phone: targetIdentifier, purpose: 'RESET_PASSWORD' } },
    });

    if (!challenge) {
      return res.status(400).json({ error: 'Verification code expired or not found. Please request a new one.' });
    }

    if (new Date() > challenge.expiresAt) {
      return res.status(400).json({ error: 'Verification code has expired.' });
    }

    const isMatch = await bcrypt.compare(code, challenge.codeHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid verification code.' });
    }

    res.json({
      valid: true,
      message: 'Code verified successfully.',
      securityQuestion: user.securityQuestion || null,
      hasSecurityQuestion: Boolean(user.securityAnswerHash),
    });
  } catch (error) {
    next(error);
  }
});

// ======================== RESET PASSWORD ========================

/**
 * POST /api/auth/reset-password
 * Email + OTP + new password (security answer verified in prior step).
 */
router.post('/reset-password', authLimiter, async (req, res, next) => {
  try {
    const emailInput = (req.body.email || '').trim().toLowerCase();
    const phoneInput = (req.body.phone || '').trim();
    const code = (req.body.code || '').trim();
    const newPassword = (req.body.newPassword || '').trim();

    if ((!emailInput && !phoneInput) || !code || !newPassword) {
      return res.status(400).json({ error: 'Email, code, and new password are required.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const { user, targetIdentifier } = await resolveUserByEmailOrPhone(emailInput, phoneInput);

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification code.' });
    }

    if (user.securityAnswerHash) {
      const securityAnswer = (req.body.securityAnswer || '').trim();
      if (!securityAnswer) {
        return res.status(400).json({ error: 'Please answer your security question.' });
      }
      const answerMatch = await bcrypt.compare(securityAnswer.toLowerCase(), user.securityAnswerHash);
      if (!answerMatch) {
        return res.status(400).json({ error: 'Incorrect answer to security question.' });
      }
    }

    const result = await verifyOTP(targetIdentifier, code, 'RESET_PASSWORD');
    if (!result.valid) {
      return res.status(400).json({ error: result.error || 'Invalid or expired code.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    next(error);
  }
});

// ======================== SETTINGS: PASSWORD / EMAIL CHANGE ========================

async function verifyCurrentPassword(user, password) {
  if (!password) return false;
  return bcrypt.compare(password, user.passwordHash);
}

async function verifyUserSecurityAnswer(user, answer) {
  if (!user.securityAnswerHash) return true;
  if (!answer) return false;
  return bcrypt.compare(answer.trim().toLowerCase(), user.securityAnswerHash);
}

/**
 * POST /api/auth/me/request-change-otp
 * CHANGE_PASSWORD: send Gmail OTP to the logged-in account (no current password).
 * CHANGE_EMAIL: current password required; OTP is sent to the new email.
 * CHANGE_PHONE: current password required; OTP is sent to the new mobile number.
 * Body: { purpose, currentPassword?, newEmail?, newPhone? }
 */
router.post('/me/request-change-otp', requireAuth, authLimiter, async (req, res, next) => {
  try {
    const purpose = req.body.purpose;
    const currentPassword = (req.body.currentPassword || '').trim();
    const newEmail = (req.body.newEmail || '').trim().toLowerCase();
    const newPhoneRaw = (req.body.newPhone || '').trim();

    if (!['CHANGE_PASSWORD', 'CHANGE_EMAIL', 'CHANGE_PHONE'].includes(purpose)) {
      return res.status(400).json({ error: 'Invalid purpose.' });
    }

    if (purpose === 'CHANGE_EMAIL' || purpose === 'CHANGE_PHONE') {
      const passwordOk = await verifyCurrentPassword(req.user, currentPassword);
      if (!passwordOk) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
      }
    }

    if (purpose === 'CHANGE_EMAIL') {
      if (!newEmail || !newEmail.includes('@')) {
        return res.status(400).json({ error: 'Enter a valid new email address.' });
      }
      const existing = await prisma.user.findUnique({ where: { email: newEmail } });
      if (existing && existing.id !== req.user.id) {
        return res.status(409).json({ error: 'An account with this email already exists. Log in instead.' });
      }
    }

    if (purpose === 'CHANGE_PHONE') {
      const phoneClean = normalizePhilippinePhone(newPhoneRaw);
      if (!phoneClean) {
        return res.status(400).json({
          error: 'Enter a valid Philippine mobile number (9XX XXX XXXX after +63).',
        });
      }
      const existingPhone = await prisma.user.findUnique({ where: { phone: phoneClean } });
      if (existingPhone && existingPhone.id !== req.user.id) {
        return res.status(409).json({ error: 'An account with this phone number already exists. Log in instead.' });
      }
      const otp = generateOTP();
      await sendOTP(phoneClean, otp, 'CHANGE_PHONE');
      return res.json({
        message: 'Verification code sent to the new mobile number.',
        ...(process.env.NODE_ENV !== 'production' && { devOtp: otp }),
      });
    }

    const otp = generateOTP();
    const emailKey = purpose === 'CHANGE_EMAIL' ? newEmail : req.user.email.toLowerCase();
    const deliverTo = purpose === 'CHANGE_EMAIL' ? newEmail : req.user.email;
    await sendOTP(emailKey, otp, purpose);
    await sendEmailOTP({ to: deliverTo, code: otp, purpose: 'RESET_PASSWORD' });

    res.json({
      message: purpose === 'CHANGE_EMAIL'
        ? 'Verification code sent to the new email address.'
        : 'Verification code sent to your email.',
      ...(process.env.NODE_ENV !== 'production' && { devOtp: otp }),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/auth/me/password
 * Body: { securityAnswer?, code, newPassword }
 */
router.patch('/me/password', requireAuth, authLimiter, async (req, res, next) => {
  try {
    const securityAnswer = (req.body.securityAnswer || '').trim();
    const code = (req.body.code || '').trim();
    const newPassword = (req.body.newPassword || '').trim();

    if (!code || !newPassword) {
      return res.status(400).json({ error: 'Verification code and new password are required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const securityOk = await verifyUserSecurityAnswer(req.user, securityAnswer);
    if (!securityOk) {
      return res.status(401).json({ error: 'Incorrect answer to security question.' });
    }

    const otpResult = await verifyOTP(req.user.email.toLowerCase(), code, 'CHANGE_PASSWORD');
    if (!otpResult.valid) {
      return res.status(400).json({ error: otpResult.error || 'Invalid or expired verification code.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash },
      include: { subscription: true, lawyerVerification: true },
    });

    res.json({ message: 'Password updated successfully.', user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/auth/me/email
 * Body: { currentPassword, code, newEmail }
 * OTP was sent to the new inbox.
 */
router.patch('/me/email', requireAuth, authLimiter, async (req, res, next) => {
  try {
    const currentPassword = (req.body.currentPassword || '').trim();
    const code = (req.body.code || '').trim();
    const newEmail = (req.body.newEmail || '').trim().toLowerCase();

    if (!currentPassword || !code || !newEmail) {
      return res.status(400).json({ error: 'Current password, verification code, and new email are required.' });
    }
    if (!newEmail.includes('@')) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }

    const existing = await prisma.user.findUnique({ where: { email: newEmail } });
    if (existing && existing.id !== req.user.id) {
      return res.status(409).json({ error: 'An account with this email already exists. Log in instead.' });
    }

    const passwordOk = await verifyCurrentPassword(req.user, currentPassword);
    if (!passwordOk) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const otpResult = await verifyOTP(newEmail, code, 'CHANGE_EMAIL');
    if (!otpResult.valid) {
      return res.status(400).json({ error: otpResult.error || 'Invalid or expired verification code.' });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { email: newEmail },
      include: { subscription: true, lawyerVerification: true },
    });

    res.json({ message: 'Email updated successfully.', user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/auth/me/phone
 * Body: { currentPassword, code, newPhone }
 * OTP was sent to the new mobile number.
 */
router.patch('/me/phone', requireAuth, authLimiter, async (req, res, next) => {
  try {
    const currentPassword = (req.body.currentPassword || '').trim();
    const code = (req.body.code || '').trim();
    const phoneClean = normalizePhilippinePhone((req.body.newPhone || '').trim());

    if (!currentPassword || !code || !phoneClean) {
      return res.status(400).json({ error: 'Current password, verification code, and new phone are required.' });
    }

    const existing = await prisma.user.findUnique({ where: { phone: phoneClean } });
    if (existing && existing.id !== req.user.id) {
      return res.status(409).json({ error: 'An account with this phone number already exists. Log in instead.' });
    }

    const passwordOk = await verifyCurrentPassword(req.user, currentPassword);
    if (!passwordOk) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const otpResult = await verifyOTP(phoneClean, code, 'CHANGE_PHONE');
    if (!otpResult.valid) {
      return res.status(400).json({ error: otpResult.error || 'Invalid or expired verification code.' });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { phone: phoneClean },
      include: { subscription: true, lawyerVerification: true },
    });

    res.json({ message: 'Phone number updated successfully.', user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/me/verify-password
 * Re-authenticate before sensitive profile edits (non email/password fields).
 */
router.post('/me/verify-password', requireAuth, authLimiter, async (req, res, next) => {
  try {
    const currentPassword = (req.body.currentPassword || '').trim();
    const passwordOk = await verifyCurrentPassword(req.user, currentPassword);
    if (!passwordOk) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    res.json({ verified: true, message: 'Password verified.' });
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
    const allowedFields = [
      'name',
      'firstName',
      'middleName',
      'lastName',
      'suffix',
      'aliases',
      'language',
      'bio',
      'avatarUrl',
      'isFirstLogin',
      'region',
      'province',
      'city',
      'barangay',
      'streetAddress',
      'zipCode',
      'address',
    ];

    // Citizens can also update their expanded-profile fields
    if (req.user.role === 'CITIZEN') {
      allowedFields.push(
        'dob',
        'gender',
        'citizenship',
        'civilStatus',
        'occupation',
        'indigencyTier',
        'citizenIdType',
        'citizenIdNumber',
        'emergencyContactName',
        'emergencyContactPhone',
        'emergencyRelationship'
      );
    }

    // Lawyers can also update these
    if (req.user.role === 'LAWYER') {
      allowedFields.push(
        'barNumber',
        'barAdmissionYear',
        'ibpChapter',
        'ibpIdNumber',
        'mcleComplianceNo',
        'ptrNumber',
        'ptrLgu',
        'lawFirmName',
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

    const sensitiveProfileFields = ['firstName', 'lastName', 'middleName', 'dob', 'citizenIdNumber', 'citizenIdType'];
    const touchesSensitive = sensitiveProfileFields.some((f) => updates[f] !== undefined);
    if (touchesSensitive) {
      const currentPassword = (req.body.currentPassword || '').trim();
      const passwordOk = await verifyCurrentPassword(req.user, currentPassword);
      if (!passwordOk) {
        return res.status(401).json({ error: 'Enter your current password to update identity fields.' });
      }
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

    // If structured name fields are supplied, update the display name
    if (updates.firstName || updates.lastName) {
      const fName = updates.firstName || req.user.firstName || '';
      const mName = updates.middleName !== undefined ? updates.middleName : (req.user.middleName || '');
      const lName = updates.lastName || req.user.lastName || '';
      const sfx = updates.suffix !== undefined ? updates.suffix : (req.user.suffix || '');
      const full = [fName, mName, lName, sfx].filter(Boolean).join(' ').trim();
      if (full) updates.name = full;
    }

    // If structured address fields are supplied and address is not explicitly overridden, compute formatted address
    if ((updates.streetAddress || updates.barangay || updates.city || updates.province || updates.region) && !req.body.address) {
      const parts = [
        updates.streetAddress || req.user.streetAddress,
        updates.barangay ? `Brgy. ${updates.barangay}` : req.user.barangay ? `Brgy. ${req.user.barangay}` : null,
        updates.city || req.user.city,
        updates.province || req.user.province,
        updates.region || req.user.region,
        updates.zipCode || req.user.zipCode,
      ].filter(Boolean);
      if (parts.length > 0) updates.address = parts.join(', ');
    }

    // Recompute verification status for citizens and lawyers based on the new state.
    if (req.user.role === 'LAWYER') {
      const merged = { ...req.user, ...updates };
      updates.isVerified = computeLawyerVerified(merged);
    } else if (req.user.role === 'CITIZEN') {
      const merged = { ...req.user, ...updates };
      updates.isVerified = Boolean(
        merged.name &&
        (merged.province || merged.city || merged.address) &&
        merged.citizenIdNumber &&
        merged.dob
      );
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

// ======================== CITIZEN VERIFICATION ========================

/**
 * POST /api/auth/me/citizen-verification
 * Upload citizen/student ID photo(s), run Gemini/Tesseract OCR, match against profile, and verify citizen.
 */
router.post(
  '/me/citizen-verification',
  requireAuth,
  govIdUpload.fields([
    { name: 'front', maxCount: 1 },
    { name: 'back', maxCount: 1 },
    { name: 'idImage', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      if (req.user.role !== 'CITIZEN') {
        return res.status(403).json({ error: 'Citizen verification is only for citizen accounts.' });
      }

      const files = req.files || {};
      const frontFile = files.front?.[0] || files.idImage?.[0] || req.file;
      const backFile = files.back?.[0];
      const selfieFile = files.selfie?.[0];

      if (!frontFile) {
        return res.status(400).json({ error: 'Front image of the ID is required.' });
      }
      if (!selfieFile) {
        return res.status(400).json({ error: 'A selfie holding the same ID is required.' });
      }

      const { idType, idNumber } = req.body;
      const frontUrl = await persistUploadedFile(frontFile, 'verification');
      const backUrl = backFile ? await persistUploadedFile(backFile, 'verification') : null;
      const selfieUrl = await persistUploadedFile(selfieFile, 'verification');

      const ocrResult = await extractCitizenIdData({
        buffer: frontFile.buffer,
        mimeType: frontFile.mimetype,
        fallbackName: req.user.name,
        fallbackIdNumber: idNumber,
      });

      const profileName = [req.user.firstName, req.user.middleName, req.user.lastName]
        .filter(Boolean)
        .join(' ')
        .trim() || req.user.name || '';
      const ocrName = (ocrResult.fullName || '').trim();
      const nameSim = nameSimilarity(ocrName, profileName);

      if (!ocrName || nameSim < 0.62) {
        const updatedUser = await prisma.user.update({
          where: { id: req.user.id },
          data: {
            isVerified: false,
            citizenVerificationStatus: 'REJECTED',
            citizenIdType: idType || ocrResult.idType || null,
            citizenIdNumber: idNumber || ocrResult.idNumber || null,
            citizenIdUrl: frontUrl,
            citizenIdBackUrl: backUrl,
            citizenSelfieUrl: selfieUrl,
          },
          include: { subscription: true },
        });
        return res.status(400).json({
          error: 'The name on this ID does not match your profile. Check your registered name or upload a clearer ID photo.',
          user: sanitizeUser(updatedUser),
          ocrExtracted: {
            fullName: ocrResult.fullName,
            idNumber: ocrResult.idNumber,
            idType: ocrResult.idType,
          },
        });
      }

      const face = await compareFaces({
        idBuffer: frontFile.buffer,
        selfieBuffer: selfieFile.buffer,
      });
      const facePass = face.provider === 'face-api.js'
        ? face.score >= 0.4
        : face.provider === 'noop'
          ? false
          : Boolean(selfieFile.buffer?.length && frontFile.buffer?.length);

      if (!facePass) {
        const updatedUser = await prisma.user.update({
          where: { id: req.user.id },
          data: {
            isVerified: false,
            citizenVerificationStatus: 'REJECTED',
            citizenIdType: idType || ocrResult.idType || null,
            citizenIdNumber: idNumber || ocrResult.idNumber || null,
            citizenIdUrl: frontUrl,
            citizenIdBackUrl: backUrl,
            citizenSelfieUrl: selfieUrl,
          },
          include: { subscription: true },
        });
        return res.status(400).json({
          error: 'The selfie does not match the photo on the ID. Hold the same ID next to your face and try again.',
          user: sanitizeUser(updatedUser),
        });
      }

      const detectedIdType = idType || ocrResult.idType || 'OTHER_GOV';
      const detectedIdNumber = idNumber || ocrResult.idNumber || null;

      const updatedUser = await prisma.user.update({
        where: { id: req.user.id },
        data: {
          isVerified: true,
          citizenVerificationStatus: 'VERIFIED',
          citizenIdType: detectedIdType,
          citizenIdNumber: detectedIdNumber,
          citizenIdUrl: frontUrl,
          citizenIdBackUrl: backUrl,
          citizenSelfieUrl: selfieUrl,
        },
        include: { subscription: true },
      });

      res.json({
        message: 'Identity documents verified. Complete remaining profile checks to reach Trust 100 and unlock booking.',
        user: sanitizeUser(updatedUser),
        ocrExtracted: {
          fullName: ocrResult.fullName,
          idNumber: ocrResult.idNumber,
          idType: ocrResult.idType,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

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
      include: incompleteSignupInclude,
    });

    if (user && user.googleId !== googleId) {
      if (await reclaimIfIncomplete(user)) user = null;
    }

    let needsLawyerOnboard = false;

    if (!user) {
      let phone = googlePlaceholderPhone(googleId);
      for (let attempt = 0; attempt < 5; attempt++) {
        const clash = await prisma.user.findUnique({
          where: { phone },
          include: incompleteSignupInclude,
        });
        if (!clash) break;
        if (await reclaimIfIncomplete(clash)) break;
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
    try { safeUser.specializations = JSON.parse(safeUser.specializations); } catch { }
  }
  if (safeUser.paymentMethods) {
    try { safeUser.paymentMethods = JSON.parse(safeUser.paymentMethods); } catch { }
  }
  if (safeUser.credentials) {
    try { safeUser.credentials = JSON.parse(safeUser.credentials); } catch { }
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
