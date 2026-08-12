// ============================================================
// Ordinex - Shared Prisma Client Singleton
// One instance reused across the whole server to avoid
// connection-pool exhaustion (each new PrismaClient() opens
// its own pool).
// ============================================================
import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__ordinexPrisma ??
  new PrismaClient({
    log: env.isDev ? ['warn', 'error'] : ['error'],
  });

if (env.isDev) globalForPrisma.__ordinexPrisma = prisma;
