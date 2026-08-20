export type PaymentMethodType = 'ewallet' | 'bank';

/** Supported e-wallet providers (matches PayMongo checkout). */
export const EWALLET_PROVIDERS = ['GCash', 'Maya'] as const;

/** Paid bookings: lawyer/citizen picks E-wallet or Bank only. */
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
    provider: type === 'ewallet' ? 'GCash' : undefined,
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
  paymaya: 'Maya',
};

export function normalizePaymentMethodType(raw: string | undefined | null): PaymentMethodType {
  const t = (raw || '').toLowerCase().trim();
  if (t === 'bank') return 'bank';
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
    else provider = 'GCash';
  }
  if (type === 'ewallet' && provider) {
    const key = provider.toLowerCase();
    provider = key === 'maya' ? 'Maya' : 'GCash';
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
  return undefined;
}

export function ewalletComplete(m: {
  accountName?: string;
  accountNumber?: string;
}): boolean {
  return Boolean(m.accountName?.trim() && m.accountNumber?.trim());
}

export function bankComplete(m: {
  accountName?: string;
  bankName?: string;
  accountNumber?: string;
}): boolean {
  return Boolean(m.accountName?.trim() && m.bankName?.trim() && m.accountNumber?.trim());
}

export function buildPaymentMethodsPayload(
  ewallet: { id: string; type: string; provider?: string; accountName: string; bankName?: string; accountNumber?: string; qrUrl?: string },
  bank: { id: string; type: string; provider?: string; accountName: string; bankName?: string; accountNumber?: string; qrUrl?: string },
): Array<{ id: string; type: 'ewallet' | 'bank'; provider?: string; accountName: string; bankName?: string; accountNumber: string; qrUrl?: string }> {
  const out: Array<{ id: string; type: 'ewallet' | 'bank'; provider?: string; accountName: string; bankName?: string; accountNumber: string; qrUrl?: string }> = [];
  if (ewalletComplete(ewallet)) {
    out.push({
      id: ewallet.id,
      type: 'ewallet',
      accountName: ewallet.accountName.trim(),
      accountNumber: ewallet.accountNumber!.trim(),
      provider: (ewallet.provider?.trim() || 'GCash'),
      ...(ewallet.qrUrl ? { qrUrl: ewallet.qrUrl } : {}),
    });
  }
  if (bankComplete(bank)) {
    out.push({
      id: bank.id,
      type: 'bank',
      accountName: bank.accountName.trim(),
      bankName: bank.bankName!.trim(),
      accountNumber: bank.accountNumber!.trim(),
    });
  }
  return out;
}
