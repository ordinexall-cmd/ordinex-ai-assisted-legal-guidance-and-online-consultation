#!/usr/bin/env node
// Force demo account sync (ignores stored version). Usage: npm run db:sync-demo
import { prisma } from '../src/config/prisma.js';
import { syncDemoAccountsIfNeeded } from '../prisma/demoAccounts.js';

const result = await syncDemoAccountsIfNeeded(prisma, { force: true, log: console.log });
if (!result.ran && result.reason === 'disabled') {
  console.log('Demo sync disabled (SYNC_DEMO_ACCOUNTS=false).');
}
await prisma.$disconnect();
