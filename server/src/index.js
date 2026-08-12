// ============================================================
// Ordinex Backend — Express Entry Point
// ============================================================
import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import authRoutes from './routes/auth.js';
import consultationRoutes from './routes/consultation.js';
import lawyersRoutes from './routes/lawyers.js';
import availabilityRoutes from './routes/availability.js';
import bookingsRoutes from './routes/bookings.js';
import notificationsRoutes from './routes/notifications.js';
import reportsRoutes from './routes/reports.js';
import paymentsRoutes from './routes/payments.js';
import adminRoutes from './routes/admin.js';
import { startScheduler } from './jobs/scheduler.js';
import { initBookingSocket } from './socket/bookingSocket.js';
import { prisma } from './config/prisma.js';
import { runDemoSyncOnStartup } from './services/demoSync.js';

const app = express();

// ======================== MIDDLEWARE ========================

// Security headers. Disable CORP so /uploads images can be loaded by the SPA.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS — allow frontend origin
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting (global)
app.use(globalLimiter);

// Serve uploaded files in dev (production uses Supabase Storage)
app.use('/uploads', express.static('uploads'));

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
