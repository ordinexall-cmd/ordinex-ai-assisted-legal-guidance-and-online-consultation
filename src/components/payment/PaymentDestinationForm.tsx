import React, { useEffect, useState } from 'react';
import { authApi, type PaymentMethod } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/userFacingError';
import { PaymentMethodFields } from './PaymentMethodFields';
import {
  BOOKING_PAYMENT_CATEGORIES,
  bankComplete,
  buildPaymentMethodsPayload,
  emptyPaymentMethod,
  ewalletComplete,
  splitPaymentMethodsByCategory,
  type BookingPaymentCategory,
} from '../../utils/paymentMethod';

export type PaymentDestinationFormProps = {
  onFeedback: (text: string, ok: boolean) => void;
  heading?: string;
  description?: string;
  idPrefix?: string;
  saveLabel?: string;
};

export const PaymentDestinationForm: React.FC<PaymentDestinationFormProps> = ({
  onFeedback,
  heading = 'Payment destination',
  description,
  idPrefix = 'payment-dest',
  saveLabel = 'Save payment destination',
}) => {
  const { user, refreshUser } = useAuth();
  const [paymentTab, setPaymentTab] = useState<BookingPaymentCategory>('ewallet');
  const [ewallet, setEwallet] = useState<PaymentMethod>(() => emptyPaymentMethod('ewallet', 'pm-ewallet'));
  const [bank, setBank] = useState<PaymentMethod>(() => emptyPaymentMethod('bank', 'pm-bank'));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const split = splitPaymentMethodsByCategory(user.paymentMethods || []);
    setEwallet(split.ewallet);
    setBank(split.bank);
  }, [user]);

  const hasEwallet = ewalletComplete(ewallet);
  const hasBank = bankComplete(bank);
  const activeMethod = paymentTab === 'ewallet' ? ewallet : bank;
  const setActiveMethod = paymentTab === 'ewallet' ? setEwallet : setBank;

  const handleSave = async () => {
    if (!user) return;
    if (!hasEwallet && !hasBank) {
      onFeedback('Enter e-wallet or bank details before saving.', false);
      return;
    }
    setSaving(true);
    try {
      await authApi.updateProfile({
        paymentMethods: buildPaymentMethodsPayload(ewallet, bank),
      });
      await refreshUser();
      onFeedback('Payment destination saved.', true);
    } catch (err) {
      onFeedback(getErrorMessage(err, 'Could not save payment destination.'), false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="payment-destination-form">
      {heading ? <h4 className="wallet-section-title">{heading}</h4> : null}
      {description ? (
        <p style={{ fontSize: 12, color: 'var(--color-ox-text-muted)', margin: '0 0 10px', lineHeight: 1.5 }}>
          {description}
        </p>
      ) : null}

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
          idPrefix={idPrefix}
        />
      </div>
      <button
        type="button"
        className="ox-btn ox-btn-secondary"
        style={{ marginTop: 10 }}
        onClick={() => { void handleSave(); }}
        disabled={saving}
      >
        {saving ? 'Saving…' : saveLabel}
      </button>
    </div>
  );
};
