// ============================================================
// Ordinex Backend — Express Entry Point
// ============================================================
import 'dotenv/config';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import { recordVisitor } from './services/llmClient.js';
import authRoutes from './routes/auth.js';
import consultationRoutes from './routes/consultation.js';
import lawyersRoutes from './routes/lawyers.js';
import availabilityRoutes from './routes/availability.js';
import bookingsRoutes from './routes/bookings.js';
import notificationsRoutes from './routes/notifications.js';
import reportsRoutes from './routes/reports.js';
import paymentsRoutes from './routes/payments.js';
import adminRoutes from './routes/admin.js';
import briefsRoutes from './routes/briefs.js';
import { startScheduler } from './jobs/scheduler.js';
import { initBookingSocket } from './socket/bookingSocket.js';
import { prisma } from './config/prisma.js';
import { runDemoSyncOnStartup } from './services/demoSync.js';
import { verifyToken } from './utils/jwt.js';

const app = express();

// Behind Render/nginx we sit behind a proxy; trust it so req.ip (used by rate
// limiting and the guest AI quota) reflects the real client, not the proxy.
if (env.TRUST_PROXY) {
  const hops = Number(env.TRUST_PROXY);
  app.set('trust proxy', Number.isFinite(hops) ? hops : env.TRUST_PROXY);
}

// ======================== MIDDLEWARE ========================

// Security headers. In production the SPA is served same-origin, so keep CORP
// same-origin to block cross-site embedding/hotlinking of uploaded assets.
// In dev the Vite server (:5173) loads images from the API (:5000), so relax it.
app.use(helmet({
  crossOriginResourcePolicy: { policy: env.isProd ? 'same-origin' : 'cross-origin' },
}));

// CORS — allow frontend origin
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// PayMongo webhook needs the exact raw bytes to verify the HMAC signature,
// so capture it before the JSON parser turns it into an object.
app.use('/api/payments/webhook/paymongo', express.raw({ type: '*/*', limit: '1mb' }));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting (global)
app.use(globalLimiter);

// Count unique daily visitors (by IP) for the traffic-aware AI quota.
app.use((req, _res, next) => {
  recordVisitor(req.ip || req.socket?.remoteAddress);
  next();
});

// Serve uploaded files. Avatars are public (rendered in <img> across the app);
// every other bucket holds sensitive material (KYC IDs, selfies, credentials,
// recordings, payment proofs, report screenshots) and requires a valid session.
// The token may arrive as a Bearer header or a ?token= query param (so <img>
// and download links can authenticate).
app.use('/uploads', (req, res, next) => {
  const firstSegment = req.path.split('/').filter(Boolean)[0];
  if (firstSegment === 'avatars') return next();

  const headerToken = (req.headers.authorization || '').startsWith('Bearer ')
    ? req.headers.authorization.split(' ')[1]
    : null;
  const token = headerToken || (typeof req.query.token === 'string' ? req.query.token : null);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required to access this file.' });
  }
  try {
    verifyToken(token);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    return next();
  } catch {
    return res.status(403).json({ error: 'Not authorized to access this file.' });
  }
}, express.static(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads')));

// ======================== ROUTES ========================

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Ordinex API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/consultation', consultationRoutes);
app.use('/api/lawyers', lawyersRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/briefs', briefsRoutes);

// ======================== STATIC SPA (production) ========================
// In production this single service also serves the built Vite frontend, so
// the SPA, API, sockets and uploads all live on one origin (one public URL).
if (env.isProd) {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.resolve(currentDir, '../../dist');

  app.use(express.static(clientDist));

  // SPA fallback: any non-API GET returns index.html so client-side routing works.
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Global error handler (must be last)
app.use(errorHandler);

// ======================== START SERVER ========================

const PORT = env.PORT;

const httpServer = http.createServer(app);
initBookingSocket(httpServer, { corsOrigin: env.FRONTEND_URL });

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`
╔══════════════════════════════════════════════╗
║  Port ${PORT} is already in use (EADDRINUSE)       ║
╠══════════════════════════════════════════════╣
║  Stop the other API process, or change PORT   ║
║  in server/.env, then restart.                ║
║                                              ║
║  Windows: netstat -ano | findstr :${PORT}          ║
║           taskkill /PID <pid> /F              ║
║                                              ║
║  Use only one API: npm run dev:all            ║
║  (not dev:all + server:dev together)          ║
╚══════════════════════════════════════════════╝
`);
    process.exit(1);
  }
  throw err;
});

httpServer.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║           ORDINEX API SERVER                 ║
║──────────────────────────────────────────────║
║  Status:  ✅ Running                         ║
║  Port:    ${String(PORT).padEnd(36)}║
║  Mode:    ${env.NODE_ENV.padEnd(36)}║
║  Health:  http://localhost:${PORT}/api/health   ║
╚══════════════════════════════════════════════╝
  `);
  startScheduler();

  runDemoSyncOnStartup()
    .then((result) => {
      if (result?.ran) return;
      return prisma.user.count().then((n) => {
        if (n === 0 && env.isDev) {
          console.warn('\n⚠️  No users in database. Run: cd server && npm run db:seed\n');
        }
      });
    })
    .catch(() => {});
});

export default app;
