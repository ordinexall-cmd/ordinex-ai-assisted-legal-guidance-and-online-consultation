// ============================================================
// Ordinex — Demo account auto-sync on server startup
// ============================================================
import {
  syncDemoAccountsIfNeeded,
  DEMO_SEED_VERSION,
} from '../../prisma/demoAccounts.js';
import { prisma } from '../config/prisma.js';

let startupPromise = null;

/** Run once per process when the API boots. */
export function runDemoSyncOnStartup() {
  if (startupPromise) return startupPromise;

  startupPromise = syncDemoAccountsIfNeeded(prisma, {
    log: console.log,
  }).catch((err) => {
    console.error('⚠️  Demo account sync failed:', err.message);
    if (process.env.NODE_ENV === 'development') {
      console.error('   Run: cd server && npx prisma db push && npm run db:seed');
    }
    return { ran: false, reason: 'error' };
  });

  return startupPromise;
}

export { DEMO_SEED_VERSION };
