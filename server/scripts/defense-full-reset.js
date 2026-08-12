/**
 * Full defense reset: wipe all users/registrations, re-seed demo accounts + slots.
 * Production requires CONFIRM_CLEAR_ALL_USERS=1 (see clearAllUsers.js).
 *
 * Usage:
 *   npm run db:defense-reset
 *   CONFIRM_CLEAR_ALL_USERS=1 NODE_ENV=production npm run db:defense-reset
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(__dirname, '..');

function run(label, script) {
  console.log(`\n▶ ${label}\n`);
  const res = spawnSync(process.execPath, [path.join(__dirname, script)], {
    cwd: serverRoot,
    stdio: 'inherit',
    env: process.env,
  });
  if (res.status !== 0) {
    console.error(`\n✗ ${label} failed (exit ${res.status})`);
    process.exit(res.status ?? 1);
  }
}

console.log('Defense full reset — all users cleared, demo accounts re-seeded.\n');

run('Clear all users', 'clearAllUsers.js');
run('Seed database', '../prisma/seed.js');
run('Clear panel lawyer', 'clear-panel-lawyer.js');

console.log('\n✓ Defense reset complete. Restart the API if it is running.\n');
