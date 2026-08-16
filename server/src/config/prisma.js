// ============================================================
// Ordinex - Shared Prisma Client Singleton
// One instance reused across the whole server to avoid
// connection-pool exhaustion (each new PrismaClient() opens
// its own pool).
// ============================================================
import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

const globalForPrisma = globalThis;

function createPrisma() {
  return new PrismaClient({
    log: env.isDev ? ['warn', 'error'] : ['error'],
  });
}

function clientHasBriefs(client) {
  return typeof client?.caseBrief?.findMany === 'function'
    && typeof client?.briefInquiry?.findMany === 'function';
}

const existing = globalForPrisma.__ordinexPrisma;
export const prisma = clientHasBriefs(existing) ? existing : createPrisma();

if (env.isDev) globalForPrisma.__ordinexPrisma = prisma;
