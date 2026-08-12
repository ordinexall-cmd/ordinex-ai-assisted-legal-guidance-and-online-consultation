// ============================================================
// Ordinex — Pending registration (DB-backed)
// ============================================================
import { prisma } from '../config/prisma.js';

const TTL_MS = 10 * 60 * 1000;

export async function savePendingRegistration(phone, data) {
  const expiresAt = new Date(Date.now() + TTL_MS);
  await prisma.pendingRegistration.upsert({
    where: { phone },
    create: { phone, payload: JSON.stringify(data), expiresAt },
    update: { payload: JSON.stringify(data), expiresAt },
  });
}

export async function getPendingRegistration(phone) {
  const row = await prisma.pendingRegistration.findUnique({ where: { phone } });
  if (!row) return null;
  if (row.expiresAt < new Date()) {
    await prisma.pendingRegistration.delete({ where: { phone } });
    return null;
  }
  try {
    return JSON.parse(row.payload);
  } catch {
    await prisma.pendingRegistration.delete({ where: { phone } });
    return null;
  }
}

export async function deletePendingRegistration(phone) {
  await prisma.pendingRegistration.deleteMany({ where: { phone } });
}
