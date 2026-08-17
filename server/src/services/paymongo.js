// ============================================================
// PayMongo Checkout Sessions (test / live via secret key prefix)
// Docs: https://developers.paymongo.com/docs/checkout
// ============================================================
import crypto from 'crypto';
import { env } from '../config/env.js';

const PAYMONGO_API = 'https://api.paymongo.com/v1';

function authHeader() {
  const key = env.PAYMONGO_SECRET_KEY;
  if (!key) throw new Error('PAYMONGO_SECRET_KEY is not configured.');
  return `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
}

export function isPaymongoConfigured() {
  return Boolean(env.PAYMONGO_SECRET_KEY && env.PAYMONGO_PUBLIC_KEY);
}

export function isPaymongoMode() {
  return env.PAYMENTS_MODE === 'paymongo' && isPaymongoConfigured();
}

/** PHP pesos → centavos (PayMongo amounts). */
export function toCentavos(phpAmount) {
  return Math.round(Number(phpAmount) * 100);
}

async function paymongoFetch(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${PAYMONGO_API}${path}`, {
    method,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      json?.errors?.[0]?.detail ||
      json?.errors?.[0]?.title ||
      `PayMongo error (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.paymongo = json;
    throw err;
  }
  return json;
}

/**
 * Create a Checkout Session. GCash-first; Maya as secondary.
 * amountPhp — citizen total in pesos.
 */
export async function createCheckoutSession({
  amountPhp,
  description,
  lineItemName,
  successUrl,
  cancelUrl,
  metadata = {},
}) {
  const amount = toCentavos(amountPhp);
  if (amount < 2000) {
    throw new Error('Amount must be at least ₱20.00 for PayMongo checkout.');
  }

  const payload = {
    data: {
      attributes: {
        send_email_receipt: false,
        show_description: true,
        show_line_items: true,
        description: description || 'Ordinex consultation payment',
        line_items: [
          {
            currency: 'PHP',
            amount,
            description: description || 'Legal consultation',
            name: lineItemName || 'Consultation fee',
            quantity: 1,
          },
        ],
        payment_method_types: ['gcash', 'paymaya'],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata,
      },
    },
  };

  const json = await paymongoFetch('/checkout_sessions', { method: 'POST', body: payload });
  const attrs = json?.data?.attributes || {};
  return {
    id: json?.data?.id,
    checkoutUrl: attrs.checkout_url,
    status: attrs.status,
    paymentIntent: attrs.payment_intent,
    metadata: attrs.metadata || metadata,
  };
}

export async function retrieveCheckoutSession(sessionId) {
  const json = await paymongoFetch(`/checkout_sessions/${sessionId}`);
  const attrs = json?.data?.attributes || {};
  const payments = attrs.payments || [];
  const paid =
    attrs.status === 'paid' ||
    payments.some((p) => {
      const st = p?.attributes?.status || p?.status;
      return st === 'paid';
    });

  let paymentMethodUsed = null;
  const first = payments[0];
  if (first?.attributes) {
    paymentMethodUsed =
      first.attributes.source?.type ||
      first.attributes.payment_method?.type ||
      null;
  }

  return {
    id: json?.data?.id,
    status: attrs.status,
    paid,
    metadata: attrs.metadata || {},
    payments,
    paymentMethodUsed,
  };
}

/**
 * Refund a PayMongo payment by id (pay_…).
 * amountPhp optional — full refund when omitted.
 */
export async function createPaymongoRefund({ paymentId, amountPhp, reason = 'requested_by_customer' }) {
  if (!paymentId) throw new Error('PayMongo payment id is required to refund.');
  const attributes = {
    payment_id: paymentId,
    reason,
  };
  if (amountPhp != null) {
    attributes.amount = toCentavos(amountPhp);
  }
  const json = await paymongoFetch('/refunds', {
    method: 'POST',
    body: { data: { attributes } },
  });
  return {
    id: json?.data?.id,
    status: json?.data?.attributes?.status,
    raw: json?.data,
  };
}

/**
 * Verify PayMongo-Signature header.
 * Format: t=timestamp,te=test_sig,li=live_sig
 * Skips verification when webhook secret is empty (local/dev).
 */
export function verifyPaymongoSignature(rawBody, signatureHeader, webhookSecret) {
  // No secret configured: only tolerated outside production (local/dev testing).
  // In production this fails closed so unverified calls can never finalize a payment.
  if (!webhookSecret) return !env.isProd;
  if (!signatureHeader || rawBody == null) return false;

  const parts = Object.fromEntries(
    String(signatureHeader)
      .split(',')
      .map((p) => p.trim().split('='))
      .filter((kv) => kv.length === 2),
  );
  const timestamp = parts.t;
  const testSig = parts.te;
  const liveSig = parts.li;
  if (!timestamp) return false;

  const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
  const signedPayload = `${timestamp}.${bodyStr}`;
  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(signedPayload)
    .digest('hex');

  const candidates = [testSig, liveSig].filter(Boolean);
  return candidates.some((sig) => timingSafeEqualHex(expected, sig));
}

function timingSafeEqualHex(a, b) {
  try {
    const ba = Buffer.from(String(a), 'hex');
    const bb = Buffer.from(String(b), 'hex');
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}
