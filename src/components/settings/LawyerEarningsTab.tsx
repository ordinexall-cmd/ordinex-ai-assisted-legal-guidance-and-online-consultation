import React, { useEffect, useMemo, useState } from 'react';
import { paymentsApi, authApi, type WalletData, type PaymentMethod } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/userFacingError';
import { PaymentMethodFields } from '../payment/PaymentMethodFields';
import {
  BOOKING_PAYMENT_CATEGORIES,
  emptyPaymentMethod,
  splitPaymentMethodsByCategory,
  type BookingPaymentCategory,
} from '../../utils/paymentMethod';

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

function ewalletComplete(m: PaymentMethod) {
  return Boolean(m.accountName.trim() && m.accountNumber?.trim());
}
function bankComplete(m: PaymentMethod) {
  return Boolean(m.accountName.trim() && m.bankName?.trim() && m.accountNumber?.trim());
}

function buildMethodsPayload(ewallet: PaymentMethod, bank: PaymentMethod): PaymentMethod[] {
  const out: PaymentMethod[] = [];
  if (ewalletComplete(ewallet)) {
    out.push({
      id: ewallet.id,
      type: 'ewallet',
      accountName: ewallet.accountName.trim(),
      accountNumber: ewallet.accountNumber!.trim(),
      ...(ewallet.provider?.trim() ? { provider: ewallet.provider.trim() } : {}),
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

export const LawyerEarningsTab: React.FC<{
  onFeedback: (text: string, ok: boolean) => void;
}> = ({ onFeedback }) => {
  const { user, refreshUser } = useAuth();
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<'GCASH' | 'BANK'>('GCASH');
  const [payoutBusy, setPayoutBusy] = useState(false);

  // Payout destination (on the same screen)
  const [paymentTab, setPaymentTab] = useState<BookingPaymentCategory>('ewallet');
  const [ewallet, setEwallet] = useState<PaymentMethod>(() => emptyPaymentMethod('ewallet', 'pm-ewallet'));
  const [bank, setBank] = useState<PaymentMethod>(() => emptyPaymentMethod('bank', 'pm-bank'));
  const [savingDest, setSavingDest] = useState(false);

  useEffect(() => {
    paymentsApi.getWallet()
      .then(setData)
      .catch((err) => onFeedback(getErrorMessage(err, 'Failed to load wallet.'), false))
      .finally(() => setLoading(false));
  }, [onFeedback]);

  useEffect(() => {
    if (!user) return;
    const split = splitPaymentMethodsByCategory(user.paymentMethods || []);
    setEwallet(split.ewallet);
    setBank(split.bank);
  }, [user]);

  const hasEwallet = ewalletComplete(ewallet);
  const hasBank = bankComplete(bank);
  const hasDestination = hasEwallet || hasBank;

  // Keep the selected payout method aligned with what's actually saved.
  useEffect(() => {
    if (payoutMethod === 'GCASH' && !hasEwallet && hasBank) setPayoutMethod('BANK');
    if (payoutMethod === 'BANK' && !hasBank && hasEwallet) setPayoutMethod('GCASH');
  }, [hasEwallet, hasBank, payoutMethod]);

  const activeMethod = paymentTab === 'ewallet' ? ewallet : bank;
  const setActiveMethod = paymentTab === 'ewallet' ? setEwallet : setBank;

  const accountDetailsFor = useMemo(() => {
    return (method: 'GCASH' | 'BANK'): Record<string, string> => {
      if (method === 'BANK') {
        return {
          type: 'bank',
          bankName: bank.bankName?.trim() || '',
          accountName: bank.accountName.trim(),
          accountNumber: bank.accountNumber?.trim() || '',
        };
      }
      return {
        type: 'ewallet',
        provider: ewallet.provider?.trim() || 'GCash',
        accountName: ewallet.accountName.trim(),
        accountNumber: ewallet.accountNumber?.trim() || '',
      };
    };
  }, [ewallet, bank]);

  const handleSaveDestination = async () => {
    if (!user) return;
    if (!hasEwallet && !hasBank) {
      onFeedback('Enter e-wallet or bank details before saving.', false);
      return;
    }
    setSavingDest(true);
    try {
      await authApi.updateProfile({ paymentMethods: buildMethodsPayload(ewallet, bank) });
      await refreshUser();
      onFeedback('Payout destination saved.', true);
    } catch (err) {
      onFeedback(getErrorMessage(err, 'Could not save payout destination.'), false);
    } finally {
      setSavingDest(false);
    }
  };

  const handlePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasDestination) {
      onFeedback('Save an e-wallet or bank destination before withdrawing.', false);
      return;
    }
    const amount = parseFloat(payoutAmount);
    if (!amount || amount <= 0) {
      onFeedback('Enter a valid payout amount.', false);
      return;
    }
    if (data && amount > data.walletBalance) {
      onFeedback(`Insufficient balance. Available: ${peso(data.walletBalance)}`, false);
      return;
    }
    setPayoutBusy(true);
    try {
      await paymentsApi.requestPayout({
        amount,
        method: payoutMethod,
        accountDetails: accountDetailsFor(payoutMethod),
      });
      onFeedback('Payout request submitted!', true);
      setPayoutAmount('');
      const refreshed = await paymentsApi.getWallet();
      setData(refreshed);
    } catch (err) {
      onFeedback(getErrorMessage(err, 'Payout request failed.'), false);
    } finally {
      setPayoutBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="settings-editor panel-rich">
        <div className="skeleton-bar" style={{ width: '100%', height: 120 }} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="settings-editor panel-rich">
        <p className="profile-email">Unable to load earnings data.</p>
      </div>
    );
  }

  return (
    <div className="settings-editor panel-rich">
      <div className="wallet-prototype-note" role="note">
        <span className="material-symbols-outlined" aria-hidden>account_balance</span>
        <p>
          Citizens pay each booking through Ordinex checkout (PayMongo — GCash/Maya). After a consult,
          85% is credited to your wallet balance below and 15% is the platform fee. Withdraw to the
          e-wallet or bank account you save on this screen.
        </p>
      </div>

      {/* Wallet summary */}
      <div className="wallet-grid">
        <div className="ox-card wallet-card">
          <p className="wallet-card__label">Available</p>
          <p className="wallet-card__amount">{peso(data.walletBalance)}</p>
        </div>
        <div className="ox-card wallet-card">
          <p className="wallet-card__label">Pending</p>
          <p className="wallet-card__amount wallet-card__amount--pending">{peso(data.walletPending)}</p>
        </div>
      </div>

      <p style={{ fontSize: 11, color: 'var(--color-ox-text-muted)', margin: '0 0 16px', lineHeight: 1.5 }}>
        <strong>Available</strong> = earnings from completed consultations you can withdraw.{' '}
        <strong>Pending</strong> = confirmed bookings awaiting consultation completion.
      </p>

      {/* Payout destination — on the same screen as the wallet */}
      <h4 className="wallet-section-title">Payout destination</h4>
      <p style={{ fontSize: 12, color: 'var(--color-ox-text-muted)', margin: '0 0 10px', lineHeight: 1.5 }}>
        Where Ordinex sends your withdrawals. Saved for payout only — never shown on your public directory.
      </p>

      <div className="settings-segment payment-type-segment" role="tablist" aria-label="Payment type">
        {BOOKING_PAYMENT_CATEGORIES.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={paymentTab === opt.value}
            className={`settings-segment__btn${paymentTab === opt.value ? ' is-active' : ''}`}
            onClick={() => setPaymentTab(opt.value)}
          >
            {opt.label}
            {((opt.value === 'ewallet' && hasEwallet) || (opt.value === 'bank' && hasBank)) ? ' ✓' : ''}
          </button>
        ))}
      </div>

      <div className="ox-card payment-method-card" style={{ marginTop: 10 }}>
        <PaymentMethodFields
          type={paymentTab}
          value={activeMethod}
          onChange={(patch) => setActiveMethod((prev) => ({ ...prev, ...patch }))}
          idPrefix="earnings"
        />
      </div>
      <button
        type="button"
        className="ox-btn ox-btn-secondary"
        style={{ marginTop: 10 }}
        onClick={handleSaveDestination}
        disabled={savingDest}
      >
        {savingDest ? 'Saving…' : 'Save payout destination'}
      </button>

      {/* Recent earnings */}
      <h4 className="wallet-section-title">Recent earnings</h4>
      {data.recentEarnings.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--color-ox-text-muted)' }}>
          No earnings yet. Complete consultations to start earning.
        </p>
      ) : (
        data.recentEarnings.map((e) => (
          <div key={e.id} className="wallet-earning-row">
            <span className="wallet-earning-row__name">{e.citizen.name}</span>
            <span className={`wallet-earning-row__status wallet-earning-row__status--${
              e.status === 'COMPLETED' || e.status === 'RATED' ? 'completed' : 'pending'
            }`}>
              {e.status === 'COMPLETED' || e.status === 'RATED' ? 'Available' : e.status}
            </span>
            <span className="wallet-earning-row__amount">
              {peso(e.lawyerShare ?? 0)}
            </span>
          </div>
        ))
      )}

      {/* Payout requests */}
      {data.payoutRequests.length > 0 && (
        <>
          <h4 className="wallet-section-title">Payout requests</h4>
          {data.payoutRequests.map((p) => (
            <div key={p.id} className="wallet-earning-row">
              <span className="wallet-earning-row__name">{p.method} · {new Date(p.createdAt).toLocaleDateString()}</span>
              <span className={`wallet-earning-row__status wallet-earning-row__status--${
                p.status === 'PAID' ? 'completed' : 'pending'
              }`}>
                {p.status}
              </span>
              <span className="wallet-earning-row__amount">{peso(p.amount)}</span>
            </div>
          ))}
        </>
      )}

      {/* Request payout */}
      {data.walletBalance > 0 && (
        <form className="ox-card wallet-payout-form" onSubmit={handlePayout}>
          <h4 className="wallet-section-title" style={{ margin: 0 }}>Request payout</h4>
          {!hasDestination && (
            <p style={{ fontSize: 12, color: 'var(--color-ox-danger, #c0392b)', margin: 0 }}>
              Save an e-wallet or bank destination above before you can withdraw.
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="form-field">
              <label className="ox-label" htmlFor="payout-amount">Amount (₱)</label>
              <input
                id="payout-amount"
                className="ox-input"
                type="number"
                min={1}
                max={data.walletBalance}
                step="0.01"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder={`Max: ${peso(data.walletBalance)}`}
                disabled={!hasDestination}
              />
            </div>
            <div className="form-field">
              <label className="ox-label" htmlFor="payout-method">Method</label>
              <select
                id="payout-method"
                className="ox-input"
                value={payoutMethod}
                onChange={(e) => setPayoutMethod(e.target.value as 'GCASH' | 'BANK')}
                disabled={!hasDestination}
              >
                <option value="GCASH" disabled={!hasEwallet}>GCash / E-wallet{hasEwallet ? '' : ' (not saved)'}</option>
                <option value="BANK" disabled={!hasBank}>Bank Transfer{hasBank ? '' : ' (not saved)'}</option>
              </select>
            </div>
          </div>
          <button className="ox-btn ox-btn-primary" type="submit" disabled={payoutBusy || !hasDestination}>
            {payoutBusy ? 'Submitting…' : 'Request Payout'}
          </button>
        </form>
      )}
    </div>
  );
};
