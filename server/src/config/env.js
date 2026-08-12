// ============================================================
// Ordinex — Environment Configuration
// Validates and exports all environment variables.
// ============================================================

const requiredInProd = (key, fallback) => {
  const val = process.env[key] || fallback;
  if (!val && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val || '';
};

export const env = {
  // Server
  PORT: parseInt(process.env.PORT || '5000', 10),
  API_PUBLIC_URL: process.env.API_PUBLIC_URL || `http://localhost:${parseInt(process.env.PORT || '5000', 10)}`,
  NODE_ENV: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',

  // Database
  DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',

  // JWT
  JWT_SECRET: requiredInProd('JWT_SECRET', 'ordinex-dev-secret-key-2026'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // Semaphore SMS
  SEMAPHORE_API_KEY: process.env.SEMAPHORE_API_KEY || '',
  SEMAPHORE_SENDER_NAME: process.env.SEMAPHORE_SENDER_NAME || 'ORDINEX',

  // Groq — AI case analysis and booking chat translation
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  GROQ_MODEL: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',

  // Google Gemini — primary fallback when Groq fails
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-1.5-flash',

  // OpenAI — optional fallback/embeddings
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_CHAT_MODEL: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
  EMBEDDING_API_URL: process.env.EMBEDDING_API_URL || '',
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',

  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || '',

  // Google OAuth (optional)
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',

  // Frontend
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Trust & bookings
  NO_SHOW_STRIKE_LIMIT: parseInt(process.env.NO_SHOW_STRIKE_LIMIT || '3', 10),
  REQUESTED_BOOKING_EXPIRE_HOURS: parseInt(process.env.REQUESTED_BOOKING_EXPIRE_HOURS || '72', 10),

  // Payments — platform-owned checkout (simulated | paymongo)
  PAYMENTS_MODE: process.env.PAYMENTS_MODE || 'simulated',
  PLATFORM_MERCHANT_NAME: process.env.PLATFORM_MERCHANT_NAME || 'Ordinex Legal Tech',
  PLATFORM_COMMISSION_RATE: parseFloat(process.env.PLATFORM_COMMISSION_RATE || '0.10'), // 10%
  APPROVED_BOOKING_EXPIRE_HOURS: parseInt(process.env.APPROVED_BOOKING_EXPIRE_HOURS || '24', 10),

  // PayMongo (test keys for now; live keys later)
  PAYMONGO_SECRET_KEY: process.env.PAYMONGO_SECRET_KEY || '',
  PAYMONGO_PUBLIC_KEY: process.env.PAYMONGO_PUBLIC_KEY || '',
  PAYMONGO_WEBHOOK_SECRET: process.env.PAYMONGO_WEBHOOK_SECRET || '',

  // Comma-separated admin emails for KYC review queue
  ADMIN_EMAILS: process.env.ADMIN_EMAILS || '',
};
