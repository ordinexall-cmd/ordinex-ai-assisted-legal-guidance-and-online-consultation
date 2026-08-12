// ============================================================
// Ordinex — JWT Utility
// Token generation and verification for authentication.
// ============================================================
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * Generate a JWT token for a user.
 * Payload includes userId, role, and isPremium status.
 */
export function generateToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      role: user.role,
      isPremium: user.isPremium,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

/**
 * Verify and decode a JWT token.
 * Returns the decoded payload or throws on invalid/expired.
 */
export function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

/** Short-lived token for lawyer KYC only (no dashboard access). */
export function generateKycToken(userId) {
  return jwt.sign(
    { userId, scope: 'lawyer_kyc' },
    env.JWT_SECRET,
    { expiresIn: '24h' },
  );
}

export function verifyKycToken(token) {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (decoded.scope !== 'lawyer_kyc') {
    const err = new Error('Invalid KYC token scope.');
    err.name = 'JsonWebTokenError';
    throw err;
  }
  return decoded;
}
