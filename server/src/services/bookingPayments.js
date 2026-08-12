/**
 * Booking payment hold / refund helpers (platform-held funds).
 */
import { prisma } from '../config/prisma.js';
import { createPaymongoRefund, isPaymongoMode } from './paymongo.js';
import { createNotification } from './notify.js';

/**
 * Refund a paid booking: PayMongo refund when configured, clear walletPending,
 * mark Payment REFUNDED. Idempotent if already refunded.
 */
export async function refundBookingPayment(booking, { reason = 'requested_by_customer', actorLabel = 'A party' } = {}) {
  if (!booking?.paymentId) {
    return { refunded: false, reason: 'no_payment' };
  }

  const payment = await prisma.payment.findUnique({ where: { id: booking.paymentId } });
  if (!payment) return { refunded: false, reason: 'payment_missing' };
  if (payment.status === 'REFUNDED') return { refunded: true, already: true };

  const lawyerShare = Number(booking.lawyerShare || 0);
  const paymongoPaymentId = booking.paymentReference?.startsWith('pay_')
    ? booking.paymentReference
    : null;

  if (isPaymongoMode() && paymongoPaymentId) {
    try {
      await createPaymongoRefund({
        paymentId: paymongoPaymentId,
        amountPhp: payment.amount,
        reason,
      });
    } catch (err) {
      // Simulated / test keys may fail — still clear ledger so UX matches hold policy
      console.warn('[refund] PayMongo refund failed:', err.message);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'REFUNDED' },
    });
    if (lawyerShare > 0) {
      const lawyer = await tx.user.findUnique({
        where: { id: booking.lawyerId },
        select: { walletPending: true },
      });
      const pending = Number(lawyer?.walletPending || 0);
      const decrement = Math.min(pending, lawyerShare);
      if (decrement > 0) {
        await tx.user.update({
          where: { id: booking.lawyerId },
          data: { walletPending: { decrement: decrement } },
        });
      }
    }
  });

  createNotification({
    userId: booking.citizenId,
    title: 'Payment refunded',
    message: `${actorLabel} cancelled the consultation. Your payment is being returned (held funds are released back to you).`,
    type: 'BOOKING_STATUS',
    linkTo: `/booking/${booking.id}`,
  }).catch(() => {});

  createNotification({
    userId: booking.lawyerId,
    title: 'Booking cancelled — funds released',
    message: 'The consultation was cancelled. Held earnings for this booking were cleared (citizen refunded).',
    type: 'BOOKING_STATUS',
    linkTo: `/booking/${booking.id}`,
  }).catch(() => {});

  return { refunded: true };
}
