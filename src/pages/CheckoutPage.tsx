import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/shell/AppShell';
import { paymentsApi, type CheckoutContext } from '../services/api';
import { getErrorMessage } from '../utils/userFacingError';
import { useAuth } from '../context/AuthContext';
import { getCitizenNav } from '../utils/citizenWorkspace';
import { ewalletComplete, bankComplete, splitPaymentMethodsByCategory } from '../utils/paymentMethod';

const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const type = params.get('type') as 'booking' | null;
  const bookingId = params.get('bookingId') || undefined;
  const paymongoSession = params.get('paymongo_session') || undefined;
  const cancelled = params.get('cancelled') === '1';

  const nav = getCitizenNav(user);

  const [ctx, setCtx] = useState<CheckoutContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [success, setSuccess] = useState('');

  const localSplit = useMemo(
    () => splitPaymentMethodsByCategory(user?.paymentMethods || []),
    [user?.paymentMethods],
  );

  const allowEwallet = ctx?.allowedChannels?.ewallet ?? ewalletComplete(localSplit.ewallet);
  const allowBank = ctx?.allowedChannels?.bank ?? bankComplete(localSplit.bank);
  const hasSavedPayment = Boolean(ctx?.allowedChannels?.ready ?? (allowEwallet || allowBank));
  const ewalletLabel = ctx?.allowedChannels?.ewalletProvider
    || localSplit.ewallet.provider
    || 'E-wallet';
  const bankLabel = ctx?.allowedChannels?.bankName
    || localSplit.bank.bankName
    || 'Bank transfer';
  const payLabel = ctx?.allowedChannels?.label
    || (allowEwallet && allowBank
      ? `${ewalletLabel} or bank`
      : allowBank
        ? bankLabel
        : ewalletLabel);

  useEffect(() => {
    if (!type || type !== 'booking') {
      setError('Invalid checkout type.');
      setLoading(false);
      return;
    }
    paymentsApi.getCheckoutContext(type, bookingId)
      .then(setCtx)
      .catch((err) => setError(getErrorMessage(err, 'Failed to load checkout.')))
      .finally(() => setLoading(false));
  }, [type, bookingId]);

  useEffect(() => {
    if (!paymongoSession || !bookingId) return;
    let cancelledRun = false;
    setConfirming(true);
    setError('');
    paymentsApi.completeSession(paymongoSession)
      .then((res) => {
        if (cancelledRun) return;
        setSuccess(res.message || 'Payment confirmed!');
        window.setTimeout(() => navigate(`/booking/${bookingId}`), 1500);
      })
      .catch((err) => {
        if (cancelledRun) return;
        setError(getErrorMessage(err, 'Could not confirm PayMongo payment.'));
        setConfirming(false);
      });
    return () => { cancelledRun = true; };
  }, [paymongoSession, bookingId, navigate]);

  const usePaymongo = ctx?.paymentsMode === 'paymongo';

  const handleConfirm = async () => {
    if (!ctx || confirming || !bookingId) return;
    if (!hasSavedPayment) {
      setError('Save an e-wallet or bank account in Settings → Billing before paying.');
      return;
    }
    setConfirming(true);
    setError('');

    try {
      if (usePaymongo) {
        const { checkoutUrl } = await paymentsApi.createSession(bookingId);
        window.location.href = checkoutUrl;
        return;
      }

      const idempotencyKey = crypto.randomUUID();
      const res = await paymentsApi.confirm({
        idempotencyKey,
        type: 'BOOKING',
        bookingId,
        method: ctx.preferredMethod || (allowBank && !allowEwallet ? 'BANK' : 'EWALLET'),
      });
      setSuccess(res.message || 'Payment confirmed!');
      window.setTimeout(() => navigate(`/booking/${bookingId}`), 2000);
    } catch (err) {
      setError(getErrorMessage(err, 'Payment failed. Please try again.'));
      setConfirming(false);
    }
  };

  return (
    <AppShell
      variant="flow"
      title="Checkout"
      navItems={nav}
      stepLabel="Pay"
      backTo={type === 'booking' && bookingId ? `/booking/${bookingId}` : '/dashboard'}
    >
      <div className="checkout-page">
        {loading && (
          <div className="checkout-skeleton">
            <div className="skeleton-bar" style={{ width: '60%', height: 24 }} />
            <div className="skeleton-bar" style={{ width: '100%', height: 80, marginTop: 16 }} />
            <div className="skeleton-bar" style={{ width: '100%', height: 48, marginTop: 16 }} />
          </div>
        )}

        {!loading && error && !ctx && (
          <div className="callout-error" role="alert">
            <p className="callout-error__text">{error}</p>
            <button
              type="button"
              className="ox-btn ox-btn-secondary"
              style={{ marginTop: 12 }}
              onClick={() => navigate(-1)}
            >
              Go back
            </button>
          </div>
        )}

        {!loading && ctx && (
          <>
            <div className="checkout-demo-badge" role="status">
              <span className="material-symbols-outlined" aria-hidden>science</span>
              <div>
                <strong>Demo payment environment</strong>
                <span>
                  {usePaymongo
                    ? 'PayMongo — you pay with the e-wallet or bank saved in your account settings.'
                    : 'Simulated checkout. Live PayMongo uses the e-wallet or bank you saved in settings.'}
                </span>
              </div>
            </div>

            <div className="checkout-merchant">
              <span className="material-symbols-outlined checkout-merchant__icon" aria-hidden>
                account_balance_wallet
              </span>
              <div>
                <p className="checkout-merchant__name">{ctx.merchant}</p>
                <p className="checkout-merchant__sub">
                  {hasSavedPayment
                    ? `Pay with ${payLabel} via PayMongo`
                    : 'Save e-wallet or bank in settings to pay'}
                </p>
              </div>
            </div>

            {cancelled && (
              <div className="callout-error" role="status" style={{ marginBottom: 12 }}>
                <p className="callout-error__text">Checkout was cancelled. You can try again when ready.</p>
              </div>
            )}

            {!hasSavedPayment && (
              <div className="callout-error" role="alert" style={{ marginBottom: 12 }}>
                <p className="callout-error__text">
                  Save an e-wallet or bank account in{' '}
                  <Link to="/settings?tab=billing" className="link-inline">Settings → Billing</Link>
                  {' '}first. Checkout only offers the method you set up.
                </p>
              </div>
            )}

            <div className="ox-card ox-card--flat checkout-summary">
              <h3 className="checkout-summary__title">Order summary</h3>
              {ctx.lineItems.map((item, i) => (
                <div key={i} className="checkout-summary__row">
                  <span>{item.label}</span>
                  <span className="checkout-summary__amount">{peso(item.amount)}</span>
                </div>
              ))}
              <div className="checkout-summary__divider" />
              <div className="checkout-summary__row checkout-summary__total">
                <span>Total</span>
                <span className="checkout-summary__amount">{peso(ctx.total)}</span>
              </div>
              {ctx.holdNotice ? (
                <p className="checkout-method__note" style={{ marginTop: 12 }}>
                  {ctx.holdNotice}
                </p>
              ) : (
                <p className="checkout-method__note" style={{ marginTop: 12 }}>
                  Pay only through Ordinex. Do not send funds to the lawyer directly. Funds are held until the session ends; 15% is the platform fee.
                </p>
              )}
            </div>

            <div className="ox-card ox-card--flat checkout-method">
              <h3 className="checkout-method__title">Payment method</h3>
              {hasSavedPayment ? (
                <div className="checkout-method__grid">
                  {allowEwallet && (
                    <div className="checkout-method__option is-selected">
                      <span className="material-symbols-outlined" aria-hidden>account_balance_wallet</span>
                      E-wallet
                      <span style={{ fontSize: 11, opacity: 0.85 }}>{ewalletLabel}</span>
                    </div>
                  )}
                  {allowBank && (
                    <div className="checkout-method__option is-selected">
                      <span className="material-symbols-outlined" aria-hidden>account_balance</span>
                      Bank transfer
                      <span style={{ fontSize: 11, opacity: 0.85 }}>{bankLabel}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="checkout-method__note">
                  No payment method saved yet.
                </p>
              )}
              <p className="checkout-method__note">
                {hasSavedPayment
                  ? `This booking will be charged through ${payLabel} — the destination you saved in account settings. Change it in Settings → Billing before paying if needed.`
                  : 'Add GCash, Maya, or a bank account in Settings → Billing. PayMongo will only show that option.'}
                {' '}Do not send funds to the lawyer directly.
              </p>
            </div>

            {error && (
              <div className="callout-error" role="alert" style={{ marginTop: 12 }}>
                <p className="callout-error__text">{error}</p>
              </div>
            )}

            {success && (
              <div className="callout-success" role="status" style={{ marginTop: 12 }}>
                <p className="callout-success__text">{success}</p>
              </div>
            )}

            <button
              type="button"
              className="ox-btn ox-btn-primary ox-btn-full checkout-confirm"
              disabled={confirming || !!success || !!paymongoSession || !hasSavedPayment}
              onClick={() => { void handleConfirm(); }}
            >
              {confirming || paymongoSession ? (
                <>
                  <span className="checkout-spinner" aria-hidden />
                  {paymongoSession ? 'Confirming payment…' : (usePaymongo ? 'Opening PayMongo…' : 'Processing…')}
                </>
              ) : success ? (
                <>
                  <span className="material-symbols-outlined" aria-hidden>check_circle</span>
                  Payment confirmed
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined" aria-hidden>lock</span>
                  {hasSavedPayment
                    ? (usePaymongo
                      ? `Pay with ${payLabel} — ${peso(ctx.total)}`
                      : `Confirm payment — ${peso(ctx.total)}`)
                    : 'Save payment details to continue'}
                </>
              )}
            </button>

            <p className="checkout-disclaimer">
              By continuing, you agree to the Ordinex{' '}
              <Link to="/terms" className="link-inline">Terms of Service</Link>
              . Fees are quoted by your lawyer after reviewing your case.
              Pay only in Ordinex. Funds are held until the session ends; 15% is the platform fee and 85% is paid to the lawyer after the consult. Do not send funds to the lawyer’s personal account. If a problem or cancellation occurs, you are refunded to your original payment method.
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
};

export default CheckoutPage;
