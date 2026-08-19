/**
 * Verify Socket.IO connects with a demo JWT (real-time layer smoke test).
 * Run from repo root: node server/scripts/verify-socket.js
 * Or: npm run test:socket --prefix server (with cwd server, uses parent node_modules)
 */
import { io } from 'socket.io-client';
import { DEMO_EMAILS, DEMO_PASSWORD } from '../prisma/demoAccounts.js';

const base = (process.argv[2] || process.env.API_VERIFY_URL || 'http://localhost:5000').replace(
  /\/$/,
  '',
);

async function login(email) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: DEMO_PASSWORD,
      role: email.includes('lawyer') ? 'LAWYER' : 'CITIZEN',
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.token) throw new Error(`Login failed for ${email}: ${JSON.stringify(data)}`);
  return data.token;
}

function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = io(base, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket'],
      timeout: 8000,
    });
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('Socket connect timeout'));
    }, 8000);
    socket.on('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function main() {
  const email = DEMO_EMAILS[0];
  const token = await login(email);
  const socket = await connectSocket(token);
  console.log('Socket OK — connected as', email, 'id:', socket.id);
  socket.close();
}

main().catch((e) => {
  console.error('Socket verification failed:', e.message || e);
  process.exit(1);
});
