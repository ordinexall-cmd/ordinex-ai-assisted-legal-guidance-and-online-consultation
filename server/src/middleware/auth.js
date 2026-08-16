// ============================================================
// Ordinex — Auth Middleware
// JWT verification + subscription expiry check.
// ============================================================
import { prisma } from '../config/prisma.js';
import { verifyToken } from '../utils/jwt.js';

/**
 * Middleware: Requires a valid JWT in the Authorization header.
 * Attaches the full user object to req.user.
 * Also checks and expires premium subscriptions automatically.
 */
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;

    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Session expired. Please log in again.' });
      }
      return res.status(401).json({ error: 'Invalid authentication token.' });
    }

    // Fetch full user from DB
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { subscription: true, lawyerVerification: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'User account not found.' });
    }

    if (user.isBanned) {
      return res.status(403).json({ error: 'Your account has been suspended.' });
    }

    if (user.suspensionUntil && new Date(user.suspensionUntil) > new Date()) {
      return res.status(403).json({
        error: `Your account is temporarily restricted until ${new Date(user.suspensionUntil).toLocaleDateString()}. Reason: ${user.suspensionReason || 'Policy violation'}.`,
        code: 'ACCOUNT_RESTRICTED',
      });
    }

    // Check subscription expiry on every authenticated request
    if (user.isPremium && user.subscription) {
      const now = new Date();
      if (new Date(user.subscription.endDate) < now) {
        // Subscription expired — update user and subscription
        await prisma.$transaction([
          prisma.user.update({
            where: { id: user.id },
            data: { isPremium: false },
          }),
          prisma.subscription.update({
            where: { id: user.subscription.id },
            data: { status: 'EXPIRED' },
          }),
        ]);
        user.isPremium = false;
        user.subscription.status = 'EXPIRED';
      }
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication service error.' });
  }
}

