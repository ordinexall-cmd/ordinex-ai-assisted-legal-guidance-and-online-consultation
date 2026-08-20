// ============================================================
// Payment method payload validation (e-wallet + bank only)
// ============================================================
import crypto from 'crypto';

const EWALLET_PROVIDERS = new Set(['gcash', 'maya']);
const LEGACY_EWALLET_TYPES = new Set(['gcash', 'maya', 'paymaya', 'grabpay', 'grab_pay', 'shopeepay']);

function norm(s) {
  return String(s || '').trim();
}

function normalizeType(raw) {
  const t = norm(raw).toLowerCase();
  if (t === 'bank') return 'bank';
  if (t === 'ewallet' || t === 'e-wallet' || LEGACY_EWALLET_TYPES.has(t)) return 'ewallet';
  return null;
}

function legacyProviderFromType(raw) {
  const t = norm(raw).toLowerCase();
  if (t === 'gcash') return 'GCash';
  if (t === 'maya' || t === 'paymaya') return 'Maya';
  return null;
}

/**
 * Validate and normalize paymentMethods profile payload.
 * @returns {{ ok: true, methods: object[] } | { ok: false, error: string }}
 */
export function validatePaymentMethodsPayload(methods) {
  if (!Array.isArray(methods)) {
    return { ok: false, error: 'paymentMethods must be an array.' };
  }
  if (methods.length > 2) {
    return { ok: false, error: 'At most one e-wallet and one bank entry are allowed.' };
  }

  const out = [];
  let hasEwallet = false;
  let hasBank = false;

  for (const raw of methods) {
    if (!raw || typeof raw !== 'object') {
      return { ok: false, error: 'Each payment method must be an object.' };
    }

    const type = normalizeType(raw.type);
    if (!type) {
      return { ok: false, error: 'Payment type must be e-wallet or bank only.' };
    }
    if (type === 'ewallet' && hasEwallet) {
      return { ok: false, error: 'Only one e-wallet entry is allowed.' };
    }
    if (type === 'bank' && hasBank) {
      return { ok: false, error: 'Only one bank entry is allowed.' };
    }

    const accountName = norm(raw.accountName);
    const accountNumber = norm(raw.accountNumber);
    if (!accountName || !accountNumber) {
      return { ok: false, error: 'Account name and account number are required.' };
    }

    const id = norm(raw.id) || cryptoRandomId();

    if (type === 'ewallet') {
      hasEwallet = true;
      let provider = norm(raw.provider) || legacyProviderFromType(raw.type) || 'GCash';
      const provKey = provider.toLowerCase();
      if (!EWALLET_PROVIDERS.has(provKey)) {
        return { ok: false, error: 'E-wallet provider must be GCash or Maya.' };
      }
      provider = provKey === 'maya' ? 'Maya' : 'GCash';
      const entry = {
        id,
        type: 'ewallet',
        provider,
        accountName,
        accountNumber,
      };
      const qrUrl = norm(raw.qrUrl);
      if (qrUrl) entry.qrUrl = qrUrl;
      out.push(entry);
    } else {
      hasBank = true;
      const bankName = norm(raw.bankName);
      if (!bankName) {
        return { ok: false, error: 'Bank name is required for bank payment methods.' };
      }
      out.push({
        id,
        type: 'bank',
        bankName,
        accountName,
        accountNumber,
      });
    }
  }

  return { ok: true, methods: out };
}

const EWALLET_PAYMONGO = ['gcash', 'paymaya'];
const BANK_PAYMONGO = ['dob', 'brankas'];

function parseSavedMethods(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Map the citizen's saved Settings → Billing destinations to PayMongo checkout types.
 * E-wallet only → GCash/Maya; bank only → DOB/Brankas; both → union.
 */
export function checkoutChannelsFromSavedMethods(raw) {
  const methods = parseSavedMethods(raw);
  const types = [];
  let hasEwallet = false;
  let hasBank = false;
  let ewalletProvider = null;
  let bankName = null;

  for (const m of methods) {
    const type = normalizeType(m?.type);
    if (type === 'ewallet') {
      hasEwallet = true;
      const prov = (norm(m.provider) || legacyProviderFromType(m.type) || 'GCash').toLowerCase();
      ewalletProvider = prov === 'maya' ? 'Maya' : 'GCash';
      if (ewalletProvider === 'Maya') types.push('paymaya');
      else types.push('gcash');
    } else if (type === 'bank') {
      hasBank = true;
      bankName = norm(m.bankName) || null;
      types.push(...BANK_PAYMONGO);
    }
  }

  const paymongoTypes = [...new Set(types)];
  let preferredMethod = 'EWALLET_OR_BANK';
  if (hasEwallet && !hasBank) preferredMethod = ewalletProvider === 'Maya' ? 'MAYA' : 'GCASH';
  else if (hasBank && !hasEwallet) preferredMethod = 'BANK';

  let ledgerMethod = 'EWALLET';
  if (hasBank && !hasEwallet) ledgerMethod = 'BANK';
  else if (ewalletProvider === 'Maya') ledgerMethod = 'MAYA';
  else if (hasEwallet) ledgerMethod = 'GCASH';

  const labels = [];
  if (hasEwallet) labels.push(ewalletProvider || 'e-wallet');
  if (hasBank) labels.push(bankName ? `${bankName} bank` : 'bank transfer');

  return {
    hasEwallet,
    hasBank,
    ewalletProvider,
    bankName,
    paymongoTypes: paymongoTypes.length ? paymongoTypes : [],
    preferredMethod,
    ledgerMethod,
    label: labels.join(' or ') || 'e-wallet or bank',
    ready: hasEwallet || hasBank,
  };
}

export { EWALLET_PAYMONGO, BANK_PAYMONGO };

function cryptoRandomId() {
  return crypto.randomUUID();
}
