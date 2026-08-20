import React from 'react';
import type { PaymentMethod } from '../../services/api';
import { EWALLET_PROVIDERS } from '../../utils/paymentMethod';

type Props = {
  type: 'ewallet' | 'bank';
  value: PaymentMethod;
  onChange: (patch: Partial<PaymentMethod>) => void;
  qrBusy?: boolean;
  onUploadQr?: (file: File) => void;
  idPrefix?: string;
};

export const PaymentMethodFields: React.FC<Props> = ({
  type,
  value,
  onChange,
  qrBusy,
  onUploadQr,
  idPrefix = 'pm',
}) => {
  const pid = `${idPrefix}-${type}`;

  if (type === 'ewallet') {
    const provider = value.provider && EWALLET_PROVIDERS.includes(value.provider as typeof EWALLET_PROVIDERS[number])
      ? value.provider
      : 'GCash';

    return (
      <div className="payment-method-fields">
        <div className="form-field">
          <label className="ox-label" htmlFor={`${pid}-provider`}>E-wallet provider</label>
          <select
            id={`${pid}-provider`}
            className="ox-input"
            value={provider}
            onChange={(e) => onChange({ provider: e.target.value })}
          >
            {EWALLET_PROVIDERS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label className="ox-label" htmlFor={`${pid}-name`}>Account name</label>
          <input
            id={`${pid}-name`}
            className="ox-input"
            placeholder="Name on the account"
            value={value.accountName}
            onChange={(e) => onChange({ accountName: e.target.value })}
          />
        </div>
        <div className="form-field">
          <label className="ox-label" htmlFor={`${pid}-num`}>Mobile / account number</label>
          <input
            id={`${pid}-num`}
            className="ox-input"
            placeholder="09XX XXX XXXX"
            value={value.accountNumber || ''}
            onChange={(e) => onChange({ accountNumber: e.target.value })}
          />
        </div>
        {onUploadQr && (
          <div className="form-field payment-method-qr">
            <span className="ox-label">QR code</span>
            <div className="payment-method-qr__row">
              {value.qrUrl && (
                <img src={value.qrUrl} alt="Payment QR" className="payment-method-qr__thumb" />
              )}
              <button
                type="button"
                className="ox-btn ox-btn-secondary"
                disabled={qrBusy}
                onClick={() => document.getElementById(`${pid}-qr-file`)?.click()}
              >
                {qrBusy ? 'Uploading…' : value.qrUrl ? 'Replace QR' : 'Upload QR image'}
              </button>
              <input
                id={`${pid}-qr-file`}
                type="file"
                accept="image/*"
                className="settings-avatar__input"
                disabled={qrBusy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUploadQr(f);
                  e.target.value = '';
                }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="payment-method-fields">
      <div className="form-field">
        <label className="ox-label" htmlFor={`${pid}-bank`}>Bank name</label>
        <input
          id={`${pid}-bank`}
          className="ox-input"
          placeholder="e.g. BPI, BDO"
          value={value.bankName || ''}
          onChange={(e) => onChange({ bankName: e.target.value })}
        />
      </div>
      <div className="form-field">
        <label className="ox-label" htmlFor={`${pid}-bname`}>Account name</label>
        <input
          id={`${pid}-bname`}
          className="ox-input"
          placeholder="Name on the account"
          value={value.accountName}
          onChange={(e) => onChange({ accountName: e.target.value })}
        />
      </div>
      <div className="form-field">
        <label className="ox-label" htmlFor={`${pid}-bnum`}>Account number</label>
        <input
          id={`${pid}-bnum`}
          className="ox-input"
          placeholder="Account number"
          value={value.accountNumber || ''}
          onChange={(e) => onChange({ accountNumber: e.target.value })}
        />
      </div>
    </div>
  );
};
