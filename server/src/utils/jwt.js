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
    { expiresIn: env.JWT_EXPIRES_IN, algorithm: 'HS256' }
  );
}

/**
 * Verify and decode a full-session JWT token.
 * Pins HS256 and rejects narrowly-scoped tokens (e.g. lawyer KYC) so they
 * can never be used as a full session credential.
 * Returns the decoded payload or throws on invalid/expired.
 */
export function verifyToken(token) {
  const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  if (decoded && decoded.scope) {
    const err = new Error('This token is not valid for full account access.');
    err.name = 'JsonWebTokenError';
    throw err;
  }
  return decoded;
}

/** Short-lived token for lawyer KYC only (no dashboard access). */
export function generateKycToken(userId) {
  return jwt.sign(
    { userId, scope: 'lawyer_kyc' },
    env.JWT_SECRET,
    { expiresIn: '24h', algorithm: 'HS256' },
  );
}

export function verifyKycToken(token) {
  const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  if (decoded.scope !== 'lawyer_kyc') {
    const err = new Error('Invalid KYC token scope.');
    err.name = 'JsonWebTokenError';
    throw err;
  }
  return decoded;
}
