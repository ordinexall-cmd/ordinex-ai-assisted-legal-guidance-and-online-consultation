// ============================================================
// Ordinex — Environment Configuration
// Validates and exports all environment variables.
// ============================================================

const isProd = (process.env.NODE_ENV || 'development') === 'production';
const PORT = parseInt(process.env.PORT || '5000', 10);
const stripSlash = (url) => String(url || '').replace(/\/$/, '');
const renderOrigin = stripSlash(process.env.RENDER_EXTERNAL_URL || '');
const defaultPublicOrigin = renderOrigin || `http://localhost:${PORT}`;

const requiredInProd = (key, fallback) => {
  const val = process.env[key] || fallback;
  if (!val && isProd) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val || '';
};

const DEV_JWT_SECRETS = new Set([
  'ordinex-dev-secret-key-2026',
  'ordinex-dev-secret-key-2026-change-in-production',
]);

/**
 * JWT secret must be a strong, explicit value in production.
 * No baked-in fallback is accepted when NODE_ENV=production.
 */
const resolveJwtSecret = () => {
  const secret = process.env.JWT_SECRET || '';
  if (isProd) {
    if (!secret) {
      throw new Error('JWT_SECRET is required in production (set a random value of at least 32 characters).');
    }
    if (DEV_JWT_SECRETS.has(secret)) {
      throw new Error('JWT_SECRET is set to a known development value. Generate a fresh random secret for production.');
    }
    if (secret.length < 32) {
      throw new Error('JWT_SECRET is too short for production. Use at least 32 random characters.');
    }
    return secret;
  }
  return secret || 'ordinex-dev-secret-key-2026';
};

/**
 * Payments must be explicitly configured. In production we refuse to boot
 * on an unknown mode, and require PayMongo credentials when in paymongo mode.
 */
const resolvePaymentsMode = () => {
  const mode = (process.env.PAYMENTS_MODE || (isProd ? '' : 'simulated')).toLowerCase();
  if (!['simulated', 'paymongo'].includes(mode)) {
    throw new Error("PAYMENTS_MODE must be 'simulated' or 'paymongo'.");
  }
  if (isProd && mode === 'paymongo') {
    if (!process.env.PAYMONGO_SECRET_KEY || !process.env.PAYMONGO_PUBLIC_KEY) {
      throw new Error('PAYMENTS_MODE=paymongo requires PAYMONGO_SECRET_KEY and PAYMONGO_PUBLIC_KEY.');
    }
    if (!process.env.PAYMONGO_WEBHOOK_SECRET) {
      throw new Error('PAYMENTS_MODE=paymongo requires PAYMONGO_WEBHOOK_SECRET so webhooks can be verified.');
    }
  }
  return mode;
};

export const env = {
  // Server
  PORT,
  API_PUBLIC_URL: stripSlash(process.env.API_PUBLIC_URL) || (isProd ? defaultPublicOrigin : `http://localhost:${PORT}`),
  NODE_ENV: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  isProd,
  // Number of proxy hops in front of the app (Render/nginx). Enables correct
  // client IPs for rate limiting. Defaults to 1 in production.
  TRUST_PROXY: process.env.TRUST_PROXY || (isProd ? '1' : ''),

  // Database
  DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',

  // JWT
  JWT_SECRET: resolveJwtSecret(),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // Transactional Email — Gmail / Custom SMTP
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '465', 10),
  SMTP_SECURE: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465' || !process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'Ordinex <ordinex.all@gmail.com>',

  // Groq — text analysis / translate + vision for KYC (live STT is Gemini-only)
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  GROQ_API_KEYS: (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '').split(',').map((k) => k.trim()).filter(Boolean),
  GROQ_MODEL: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  // Kept for backward compatibility; analysis now uses a single model (GROQ_MODEL).
  GROQ_LIGHT_MODEL: process.env.GROQ_LIGHT_MODEL || 'openai/gpt-oss-20b',
  // Multimodal vision model for ID OCR + selfie match (chat completions with image_url).
  GROQ_VISION_MODEL: process.env.GROQ_VISION_MODEL || 'qwen/qwen3.6-27b',

  // Google Gemini — live consult captions + vision fallback
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_API_KEYS: (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '').split(',').map((k) => k.trim()).filter(Boolean),
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-3.6-flash',

  // Google OAuth (optional)
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',

  // Frontend
  FRONTEND_URL: stripSlash(process.env.FRONTEND_URL) || (isProd ? defaultPublicOrigin : 'http://localhost:5173'),

  // Trust & bookings
  NO_SHOW_STRIKE_LIMIT: parseInt(process.env.NO_SHOW_STRIKE_LIMIT || '3', 10),
  REQUESTED_BOOKING_EXPIRE_HOURS: parseInt(process.env.REQUESTED_BOOKING_EXPIRE_HOURS || '72', 10),

  // Payments — platform-owned checkout (simulated | paymongo)
  PAYMENTS_MODE: resolvePaymentsMode(),
  PLATFORM_MERCHANT_NAME: process.env.PLATFORM_MERCHANT_NAME || 'Ordinex Legal Tech',
  PLATFORM_COMMISSION_RATE: parseFloat(process.env.PLATFORM_COMMISSION_RATE || '0.15'), // 15%
  APPROVED_BOOKING_EXPIRE_HOURS: parseInt(process.env.APPROVED_BOOKING_EXPIRE_HOURS || '24', 10),

  // PayMongo (test keys for now; live keys later)
  PAYMONGO_SECRET_KEY: process.env.PAYMONGO_SECRET_KEY || '',
  PAYMONGO_PUBLIC_KEY: process.env.PAYMONGO_PUBLIC_KEY || '',
  PAYMONGO_WEBHOOK_SECRET: process.env.PAYMONGO_WEBHOOK_SECRET || '',

  // Comma-separated admin emails for KYC review queue
  ADMIN_EMAILS: process.env.ADMIN_EMAILS || '',
};
