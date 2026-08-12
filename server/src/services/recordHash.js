// ============================================================
// Ordinex — Consultation record integrity (SHA-256 chain)
// Blockchain anchoring is optional (blockchainTxHash left null).
// ============================================================
import { prisma } from '../config/prisma.js';
import { sha256 } from '../utils/hash.js';
import { parseTranscript, transcriptSha256 } from './transcriptStore.js';

/**
 * Create a RecordHash row when a booking is completed.
 * @param {object} booking - booking with citizen, lawyer, availability
 */
export async function anchorBookingRecord(booking) {
  const existing = await prisma.recordHash.findUnique({
    where: { bookingId: booking.id },
  });
  if (existing) return existing;

  const last = await prisma.recordHash.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { dataHash: true },
  });

  const payload = {
    bookingId: booking.id,
    citizenId: booking.citizenId,
    lawyerId: booking.lawyerId,
    status: booking.status,
    feeAtBooking: booking.feeAtBooking,
    slot: booking.availability
      ? {
          date: booking.availability.date,
          startTime: booking.availability.startTime,
          endTime: booking.availability.endTime,
        }
      : null,
    completedAt: new Date().toISOString(),
  };

  const tx = parseTranscript(booking.transcript);
  if (tx.plainText?.trim()) {
    payload.transcriptSha256 = transcriptSha256(tx);
  }
  if (booking.recordingUrl) {
    payload.recordingUrl = booking.recordingUrl;
    payload.recordingSha256 = sha256({ recordingUrl: booking.recordingUrl, bookingId: booking.id });
  }

  const dataHash = sha256(payload);
  const previousHash = last?.dataHash ?? null;

  return prisma.recordHash.create({
    data: {
      bookingId: booking.id,
      dataHash,
      previousHash,
      anchoredAt: new Date(),
    },
  });
}
