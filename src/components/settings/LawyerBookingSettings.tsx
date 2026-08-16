import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authApi, type PaymentMethod } from '../../services/api';
import { getErrorMessage } from '../../utils/userFacingError';
import { PaymentMethodFields } from '../payment/PaymentMethodFields';
import {
  BOOKING_PAYMENT_CATEGORIES,
  emptyPaymentMethod,
  splitPaymentMethodsByCategory,
  type BookingPaymentCategory,
} from '../../utils/paymentMethod';

function buildMethodsPayload(ewallet: PaymentMethod, bank: PaymentMethod): PaymentMethod[] {
  const out: PaymentMethod[] = [];
  if (ewallet.accountName.trim() && ewallet.accountNumber?.trim()) {
    out.push({
      id: ewallet.id,
      type: 'ewallet',
      accountName: ewallet.accountName.trim(),
      accountNumber: ewallet.accountNumber.trim(),
      ...(ewallet.provider?.trim() ? { provider: ewallet.provider.trim() } : {}),
      ...(ewallet.qrUrl ? { qrUrl: ewallet.qrUrl } : {}),
    });
  }
  if (bank.accountName.trim() && bank.bankName?.trim() && bank.accountNumber?.trim()) {
    out.push({
      id: bank.id,
      type: 'bank',
      accountName: bank.accountName.trim(),
      bankName: bank.bankName.trim(),
      accountNumber: bank.accountNumber.trim(),
    });
  }
  return out;
}

export const LawyerBookingSettings: React.FC<{
  onFeedback: (text: string, ok: boolean) => void;
}> = ({ onFeedback }) => {
  const { user, refreshUser } = useAuth();
  const [acceptingBookings, setAcceptingBookings] = useState(true);
  const [feeMin, setFeeMin] = useState('');
  const [feeMax, setFeeMax] = useState('');
  const [paymentTab, setPaymentTab] = useState<BookingPaymentCategory>('ewallet');
  const [ewallet, setEwallet] = useState<PaymentMethod>(() => emptyPaymentMethod('ewallet', 'pm-ewallet'));
  const [bank, setBank] = useState<PaymentMethod>(() => emptyPaymentMethod('bank', 'pm-bank'));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setAcceptingBookings(user.acceptingBookings !== false);
    const min = user.consultationFeeMin ?? user.consultationFee;
    const max = user.consultationFeeMax ?? min;
    setFeeMin(min != null ? String(min) : '');
    setFeeMax(max != null ? String(max) : '');
    const split = splitPaymentMethodsByCategory(user.paymentMethods || []);
    setEwallet(split.ewallet);
    setBank(split.bank);
  }, [user]);

  const activeMethod = paymentTab === 'ewallet' ? ewallet : bank;
  const setActiveMethod = paymentTab === 'ewallet' ? setEwallet : setBank;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const min = parseFloat(feeMin) || 0;
      const max = parseFloat(feeMax) || min;
      if (min > max) {
        onFeedback('Minimum fee cannot exceed maximum fee.', false);
        return;
      }

      await authApi.updateProfile({
        practiceType: 'PRIVATE',
        acceptingBookings,
        consultationFeeMin: min,
        consultationFeeMax: max,
        consultationFee: min,
        paymentMethods: buildMethodsPayload(ewallet, bank),
      });
      await refreshUser();
      onFeedback('Booking settings saved.', true);
    } catch (err) {
      onFeedback(getErrorMessage(err, 'Save failed. Please try again.'), false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="settings-editor panel-rich" onSubmit={handleSave}>
      <section className="settings-editor__section">
        <h3 className="settings-section-title">Booking status</h3>
        <p className="profile-email settings-practice-summary__hint" style={{ marginBottom: 10 }}>
          Private practice — paid consultations. Citizens see your fee range on your profile.
        </p>
        <label className="settings-toggle-row" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
          <input
            type="checkbox"
            checked={acceptingBookings}
            onChange={(e) => setAcceptingBookings(e.target.checked)}
          />
          <span className="ox-label" style={{ margin: 0 }}>Accepting new booking requests</span>
        </label>
      </section>

      <section className="settings-editor__section">
        <h3 className="settings-section-title">
          Consultation fee range (PHP)
        </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-field">
              <label className="ox-label" htmlFor="fee-min">Minimum</label>
              <input
                id="fee-min"
                className="ox-input"
                type="number"
                min={0}
                value={feeMin}
                onChange={(e) => setFeeMin(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="ox-label" htmlFor="fee-max">Maximum</label>
              <input
                id="fee-max"
                className="ox-input"
                type="number"
                min={0}
                value={feeMax}
                onChange={(e) => setFeeMax(e.target.value)}
              />
            </div>
          </div>
      </section>

      <section className="settings-editor__section">
        <h3 className="settings-section-title">Payout destination</h3>
        <p className="profile-email settings-practice-summary__hint" style={{ marginBottom: 10 }}>
          These numbers are for Ordinex to send your 85% after the consult. Citizens pay through Ordinex checkout (PayMongo/GCash), not your personal wallet. Details are stored for payout only and are not shown on your public directory. The remaining 15% is the platform fee.
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
            </button>
          ))}
        </div>

        <div className="ox-card payment-method-card" style={{ marginTop: 10 }}>
          <PaymentMethodFields
            type={paymentTab}
            value={activeMethod}
            onChange={(patch) => setActiveMethod((prev) => ({ ...prev, ...patch }))}
            idPrefix="settings"
          />
        </div>
        <p className="profile-email settings-practice-summary__hint" style={{ marginTop: 8 }}>
          Save e-wallet or bank details, then request a withdrawal from the Earnings tab.
        </p>
      </section>

      <section className="settings-editor__section">
        <h3 className="settings-section-title">Availability</h3>
        <p className="profile-email settings-practice-summary__hint">
          Open time slots are managed on your schedule page.
        </p>
        <Link to="/lawyer/schedule" className="ox-btn ox-btn-primary" style={{ marginTop: 10, display: 'inline-flex' }}>
          Manage availability slots
        </Link>
      </section>

      <div className="settings-actions form-actions-bar">
        <button className="ox-btn ox-btn-primary" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save booking settings'}
        </button>
      </div>
    </form>
  );
};
