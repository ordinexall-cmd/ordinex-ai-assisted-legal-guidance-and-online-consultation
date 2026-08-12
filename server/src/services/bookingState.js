// ============================================================
// Ordinex - Booking State Machine
// ============================================================

export const STATUS = Object.freeze({
  REQUESTED: 'REQUESTED',
  APPROVED: 'APPROVED',
  PAYMENT_SUBMITTED: 'PAYMENT_SUBMITTED',
  CONFIRMED: 'CONFIRMED',
  DECLINED: 'DECLINED',
  AUTO_CANCELLED: 'AUTO_CANCELLED',
  CANCELLED_REFUNDED: 'CANCELLED_REFUNDED',
  NO_SHOW: 'NO_SHOW',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  RATED: 'RATED',
});

const TERMINAL = new Set([
  STATUS.DECLINED,
  STATUS.AUTO_CANCELLED,
  STATUS.CANCELLED_REFUNDED,
  STATUS.RATED,
  STATUS.NO_SHOW,
]);

/**
 * Allowed transitions, keyed by current status.
 * Each entry maps the next status to the role that can trigger it
 * ('citizen' | 'lawyer' | 'system').
 */
const TRANSITIONS = {
  REQUESTED: {
    APPROVED: ['lawyer'],
    DECLINED: ['lawyer'],
    AUTO_CANCELLED: ['system'],
  },
  APPROVED: {
    PAYMENT_SUBMITTED: ['citizen'],
    CONFIRMED: ['citizen', 'system'],
    AUTO_CANCELLED: ['system'],
    CANCELLED_REFUNDED: ['citizen', 'lawyer'], // unpaid cancel = no refund needed; same label ok
  },
  PAYMENT_SUBMITTED: {
    CONFIRMED: ['lawyer'],
    AUTO_CANCELLED: ['system'],
    CANCELLED_REFUNDED: ['citizen', 'lawyer'],
  },
  CONFIRMED: {
    IN_PROGRESS: ['citizen', 'lawyer'],
    COMPLETED: ['lawyer'], // lawyer closes case → releases held funds
    NO_SHOW: ['citizen', 'lawyer', 'system'],
    CANCELLED_REFUNDED: ['citizen', 'lawyer'], // before session starts
  },
  IN_PROGRESS: {
    COMPLETED: ['lawyer'], // only lawyer releases payment
    NO_SHOW: ['citizen', 'lawyer'],
  },
  COMPLETED: {
    RATED: ['citizen'],
  },
};

/**
 * Returns null if the transition is allowed, otherwise an error string.
 */
export function checkTransition(from, to, actor) {
  if (TERMINAL.has(from)) {
    return `Cannot change a booking that is already ${from}.`;
  }
  const allowed = TRANSITIONS[from];
  if (!allowed || !allowed[to]) {
    return `Cannot transition from ${from} to ${to}.`;
  }
  if (!allowed[to].includes(actor)) {
    return `${actor} is not allowed to make this transition.`;
  }
  return null;
}

/**
 * Whether the chat sidebar is open for this booking.
 * Chat opens on CONFIRMED or IN_PROGRESS and stays open for 30 minutes after
 * COMPLETED (chatClosedAt is set when the booking is completed).
 */
export function isChatOpen(booking) {
  if (!booking) return false;
  if (booking.status === STATUS.CONFIRMED || booking.status === STATUS.IN_PROGRESS) return true;
  if (booking.status === STATUS.COMPLETED && booking.chatClosedAt) {
    return new Date(booking.chatClosedAt).getTime() > Date.now();
  }
  return false;
}

/** Paid statuses that may need refund on cancel / no-show. */
export function isPaidBooking(booking) {
  if (!booking) return false;
  if (booking.paymentId) return true;
  return ['CONFIRMED', 'IN_PROGRESS', 'PAYMENT_SUBMITTED'].includes(booking.status)
    && Number(booking.quotedFee || booking.feeAtBooking || 0) > 0;
}
