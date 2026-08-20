// ============================================================
// Ordinex — Rate Limiter Middleware
// Prevents brute-force and abuse using express-rate-limit.
// ============================================================
import rateLimit from 'express-rate-limit';
import { verifyToken } from '../utils/jwt.js';

const isProd = process.env.NODE_ENV === 'production';

function bearerUserId(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const decoded = verifyToken(authHeader.split(' ')[1]);
    return decoded?.userId ?? null;
  } catch {
    return null;
  }
}

/**
 * Global rate limiter — per authenticated user when JWT present, else per IP.
 * Production: 500 req / 15 min per user, 100 / 15 min per IP for guests.
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req) => {
    if (!isProd) return 10_000;
    return bearerUserId(req) ? 500 : 100;
  },
  keyGenerator: (req) => {
    const userId = bearerUserId(req);
    if (userId) return `user:${userId}`;
    return `ip:${req.ip}`;
  },
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !isProd || req.path === '/api/health',
});

/**
 * Auth rate limiter: 10 attempts per 15 minutes per IP in production.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 10 : 500,
  message: { error: 'Too many authentication attempts. Please wait 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * AI rate limiter: 20 case identifications per 10 minutes per IP.
 */
export const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: { error: 'Too many AI requests. Please wait a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Guest preview rate limiter: anonymous landing teaser.
 */
export const guestPreviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5 : 30,
  message: { error: 'Too many preview requests. Please try again later or create a free account.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Daily AI Quota Limiter: 5 case identifications per 24-hour window per IP/user.
 */
export const dailyAiQuotaLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 5,
  message: {
    error: 'You have reached your daily free case identification limit (5/5). Your limit resets tomorrow! Register or log in to view your saved history and book a consultation with a lawyer.',
    quotaExceeded: true,
  },
  standardHeaders: true,
  legacyHeaders: false,
});
