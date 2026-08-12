export type PaymentMethodType = 'ewallet' | 'bank' | 'cash';

/** Paid bookings: lawyer picks E-wallet or Bank only. */
export const BOOKING_PAYMENT_CATEGORIES = [
  { value: 'ewallet' as const, label: 'E-wallet' },
  { value: 'bank' as const, label: 'Bank' },
];

export type BookingPaymentCategory = (typeof BOOKING_PAYMENT_CATEGORIES)[number]['value'];

export function emptyPaymentMethod(type: BookingPaymentCategory, id?: string): {
  id: string;
  type: BookingPaymentCategory;
  provider?: string;
  accountName: string;
  bankName?: string;
  accountNumber?: string;
  qrUrl?: string;
} {
  return {
    id: id || crypto.randomUUID(),
    type,
    accountName: '',
    provider: type === 'ewallet' ? '' : undefined,
    bankName: type === 'bank' ? '' : undefined,
    accountNumber: '',
    qrUrl: undefined,
  };
}

export function splitPaymentMethodsByCategory(
  methods: Array<{
    id: string;
    type: string;
    provider?: string;
    accountName?: string;
    bankName?: string;
    accountNumber?: string;
    qrUrl?: string;
  }>,
): {
  ewallet: ReturnType<typeof emptyPaymentMethod>;
  bank: ReturnType<typeof emptyPaymentMethod>;
} {
  const normalized = methods.map((m) => normalizePaymentMethodRecord(m));
  const ewalletRaw = normalized.find((m) => normalizePaymentMethodType(m.type) === 'ewallet');
  const bankRaw = normalized.find((m) => normalizePaymentMethodType(m.type) === 'bank');
  const ewallet = ewalletRaw
    ? { ...emptyPaymentMethod('ewallet', ewalletRaw.id), ...ewalletRaw, type: 'ewallet' as const }
    : emptyPaymentMethod('ewallet', 'pm-ewallet');
  const bank = bankRaw
    ? { ...emptyPaymentMethod('bank', bankRaw.id), ...bankRaw, type: 'bank' as const }
    : emptyPaymentMethod('bank', 'pm-bank');
  return { ewallet, bank };
}

const LEGACY_EWALLET: Record<string, string> = {
  gcash: 'GCash',
  maya: 'Maya',
};

export function normalizePaymentMethodType(raw: string | undefined | null): PaymentMethodType {
  const t = (raw || '').toLowerCase().trim();
  if (t === 'bank') return 'bank';
  if (t === 'cash' || t === 'other') return 'cash';
  if (t === 'ewallet' || t === 'e-wallet') return 'ewallet';
  if (t in LEGACY_EWALLET) return 'ewallet';
  if (t.includes('bank')) return 'bank';
  return 'ewallet';
}

export function normalizePaymentMethodRecord<T extends {
  id: string;
  type: string;
  provider?: string;
  accountName?: string;
  bankName?: string;
  accountNumber?: string;
  qrUrl?: string;
}>(m: T): T {
  const type = normalizePaymentMethodType(m.type);
  let provider = m.provider?.trim() || legacyProviderFromType(m.type) || '';
  if (!provider && type === 'ewallet') {
    if (/gcash/i.test(m.id)) provider = 'GCash';
    else if (/maya/i.test(m.id)) provider = 'Maya';
    else if (/grab/i.test(m.id)) provider = 'GrabPay';
  }
  return {
    ...m,
    type,
    ...(provider ? { provider } : {}),
  } as T;
}

function legacyProviderFromType(raw: string | undefined | null): string | undefined {
  const t = (raw || '').toLowerCase().trim();
  if (LEGACY_EWALLET[t]) return LEGACY_EWALLET[t];
  if (t === 'gcash' || t === 'maya') return LEGACY_EWALLET[t];
  const known = ['gcash', 'maya', 'grabpay', 'paymaya'];
  if (known.includes(t)) return raw?.trim();
  if (raw && !['bank', 'cash', 'other', 'ewallet', 'e-wallet'].includes(t)) {
    return raw.trim();
  }
  return undefined;
}

