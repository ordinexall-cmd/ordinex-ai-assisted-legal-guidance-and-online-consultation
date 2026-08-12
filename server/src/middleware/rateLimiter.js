// ============================================================
// Ordinex — Rate Limiter Middleware
// Prevents brute-force and abuse using express-rate-limit.
// ============================================================
import rateLimit from 'express-rate-limit';

/**
 * Global rate limiter: 200 requests per 15 minutes per IP.
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Auth rate limiter: 10 attempts per 15 minutes per IP.
 * Used on login, register, OTP endpoints to prevent brute-force.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 100,
  message: { error: 'Too many authentication attempts. Please wait 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * AI rate limiter: 20 analyses per 10 minutes per IP.
 * The product cap is 3 lifetime trials (free) or unlimited (premium);
 * this exists only to throttle abuse / runaway clients.
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
 * Production: 5/hour per IP; development: 30/hour per IP.
 */
export const guestPreviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5 : 30,
  message: { error: 'Too many preview requests. Please try again later or create a free account.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Daily AI Quota Limiter: 5 case analyses per 24-hour window per IP/user.
 * Friendly limit alert message when hit.
 */
export const dailyAiQuotaLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5,
  message: {
    error: 'You have reached your daily free case analysis limit (5/5). Your limit resets tomorrow! Register or log in to view your saved history and book a consultation with a lawyer.',
    quotaExceeded: true,
  },
  standardHeaders: true,
  legacyHeaders: false,
});
