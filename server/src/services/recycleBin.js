import { prisma } from '../config/prisma.js';

/** Days deleted items remain recoverable before permanent removal. */
export const TRASH_RETENTION_DAYS = 7;

export function trashCutoffDate() {
  const d = new Date();
  d.setDate(d.getDate() - TRASH_RETENTION_DAYS);
  return d;
}

export function daysRemainingInTrash(deletedAt) {
  if (!deletedAt) return 0;
  const expires = new Date(deletedAt);
  expires.setDate(expires.getDate() + TRASH_RETENTION_DAYS);
  const ms = expires.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

/** Permanently remove consultations past the retention window. */
export async function purgeExpiredTrash() {
  const cutoff = trashCutoffDate();
  const [deletedConsultations, updatedCitizenBookings, updatedLawyerBookings] = await Promise.all([
    prisma.consultation.deleteMany({
      where: { deletedAt: { not: null, lt: cutoff } },
    }),
    prisma.booking.updateMany({
      where: { citizenDeletedAt: { not: null, lt: cutoff } },
      data: { citizenDeletedAt: null },
    }),
    prisma.booking.updateMany({
      where: { lawyerDeletedAt: { not: null, lt: cutoff } },
      data: { lawyerDeletedAt: null },
    }),
  ]);
  return {
    consultations: deletedConsultations.count,
    citizenBookingTrash: updatedCitizenBookings.count,
    lawyerBookingTrash: updatedLawyerBookings.count,
  };
}
