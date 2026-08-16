import React, { useEffect, useState } from 'react';
import { paymentsApi, type WalletData } from '../../services/api';
import { getErrorMessage } from '../../utils/userFacingError';

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export const LawyerEarningsTab: React.FC<{
  onFeedback: (text: string, ok: boolean) => void;
}> = ({ onFeedback }) => {
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<'GCASH' | 'BANK'>('GCASH');
  const [payoutBusy, setPayoutBusy] = useState(false);

  useEffect(() => {
    paymentsApi.getWallet()
      .then(setData)
      .catch((err) => onFeedback(getErrorMessage(err, 'Failed to load wallet.'), false))
      .finally(() => setLoading(false));
  }, [onFeedback]);

  const handlePayout = async (e: React.FormEvent) => {
    e.preventDefault();
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
        accountDetails: { note: 'Payout request from settings' },
      });
      onFeedback('Payout request submitted!', true);
      setPayoutAmount('');
      // Reload wallet data
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
          Wallet balance is a <strong>platform ledger (prototype)</strong>. After a consult, 85% of the
          citizen’s Ordinex payment is recorded here. Request a payout to the e-wallet or bank account
          saved on the Practice tab. Automated PayMongo payouts are future work.
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
              />
            </div>
            <div className="form-field">
              <label className="ox-label" htmlFor="payout-method">Method</label>
              <select
                id="payout-method"
                className="ox-input"
                value={payoutMethod}
                onChange={(e) => setPayoutMethod(e.target.value as 'GCASH' | 'BANK')}
              >
                <option value="GCASH">GCash</option>
                <option value="BANK">Bank Transfer</option>
              </select>
            </div>
          </div>
          <button className="ox-btn ox-btn-primary" type="submit" disabled={payoutBusy}>
            {payoutBusy ? 'Submitting…' : 'Request Payout'}
          </button>
        </form>
      )}
    </div>
  );
};
