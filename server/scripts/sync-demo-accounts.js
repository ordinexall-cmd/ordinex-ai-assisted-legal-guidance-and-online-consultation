#!/usr/bin/env node
// Force demo account sync (ignores stored version). Usage: npm run db:sync-demo
import { prisma } from '../src/config/prisma.js';
import {
  DEMO_SEED_VERSION,
  DEMO_PASSWORD,
  syncDemoAccounts,
  setStoredDemoVersion,
} from '../prisma/demoAccounts.js';

console.log(`\n🔄 Syncing demo accounts (force v${DEMO_SEED_VERSION})...`);
await syncDemoAccounts(prisma, {
  log: (msg) => console.log(`   ✅ ${msg}`),
  resetPasswords: true,
});
await setStoredDemoVersion(prisma, DEMO_SEED_VERSION);
console.log(`✅ Demo accounts synced to v${DEMO_SEED_VERSION} (password: ${DEMO_PASSWORD})\n`);
await prisma.$disconnect();
