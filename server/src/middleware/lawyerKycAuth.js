// ============================================================
// Ordinex — Lawyer KYC Auth Middleware
// Accepts full JWT (unverified lawyer) or kycToken (lawyer_kyc scope).
// ============================================================
import { prisma } from '../config/prisma.js';
import { verifyToken, verifyKycToken } from '../utils/jwt.js';

/**
 * Loads the lawyer user for verification endpoints.
 * Sets req.user and req.kycSession = true when authenticated via kycToken.
 */
export async function requireLawyerKyc(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Verification session required. Please continue from registration.' });
    }

    const token = authHeader.split(' ')[1];
    let userId;
    let kycSession = false;

    try {
      const decoded = verifyKycToken(token);
      userId = decoded.userId;
      kycSession = true;
    } catch (kycErr) {
      if (kycErr.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Verification session expired. Please register again.' });
      }
      try {
        const decoded = verifyToken(token);
        userId = decoded.userId;
      } catch (err) {
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({ error: 'Session expired. Please log in again.' });
        }
        return res.status(401).json({ error: 'Invalid authentication token.' });
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true, lawyerVerification: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'User account not found.' });
    }

    if (user.isBanned) {
      return res.status(403).json({ error: 'Your account has been suspended.' });
    }

    if (user.role !== 'LAWYER') {
      return res.status(403).json({ error: 'Only lawyers can use the verification flow.' });
    }

    if (user.isVerified && kycSession) {
      return res.status(403).json({
        error: 'Your counsel account is already verified. Please log in.',
        code: 'LAWYER_ALREADY_VERIFIED',
      });
    }

    req.user = user;
    req.kycSession = kycSession;
    next();
  } catch (error) {
    console.error('Lawyer KYC auth error:', error);
    return res.status(500).json({ error: 'Authentication service error.' });
  }
}
