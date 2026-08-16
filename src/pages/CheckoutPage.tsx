import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/shell/AppShell';
import { paymentsApi, type CheckoutContext } from '../services/api';
import { getErrorMessage } from '../utils/userFacingError';
import { useAuth } from '../context/AuthContext';
import { getCitizenNav } from '../utils/citizenWorkspace';

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

  // Return from PayMongo success_url
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
        method: 'GCASH',
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
                    ? 'PayMongo test mode — no real funds move. Live keys activate after merchant verification and deploy.'
                    : 'Simulated checkout for offline demos. Switch to PayMongo test mode for GCash-hosted checkout.'}
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
                  {usePaymongo
                    ? 'Pay with GCash via PayMongo (test mode)'
                    : 'Simulated checkout — GCash-first for live later'}
                </p>
              </div>
            </div>

            {cancelled && (
              <div className="callout-error" role="status" style={{ marginBottom: 12 }}>
                <p className="callout-error__text">Checkout was cancelled. You can try again when ready.</p>
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
                  Pay only through Ordinex. Do not send GCash to the lawyer. Funds are held until the session ends; 15% is the platform fee.
                </p>
              )}
            </div>

            <div className="ox-card ox-card--flat checkout-method">
              <h3 className="checkout-method__title">Payment method</h3>
              <div className="checkout-method__grid">
                <button type="button" className="checkout-method__option is-selected" disabled>
                  <span className="material-symbols-outlined" aria-hidden>account_balance_wallet</span>
                  GCash
                </button>
              </div>
              <p className="checkout-method__note">
                Pay only through Ordinex (PayMongo). Do not send GCash to the lawyer directly.
                Maya may appear as a secondary option on the PayMongo checkout screen.
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
              disabled={confirming || !!success || !!paymongoSession}
              onClick={() => { void handleConfirm(); }}
            >
              {confirming || paymongoSession ? (
                <>
                  <span className="checkout-spinner" aria-hidden />
                  {paymongoSession ? 'Confirming GCash payment…' : (usePaymongo ? 'Opening GCash…' : 'Processing…')}
                </>
              ) : success ? (
                <>
                  <span className="material-symbols-outlined" aria-hidden>check_circle</span>
                  Payment confirmed
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined" aria-hidden>lock</span>
                  {usePaymongo
                    ? `Pay with GCash — ${peso(ctx.total)}`
                    : `Confirm payment — ${peso(ctx.total)}`}
                </>
              )}
            </button>

            <p className="checkout-disclaimer">
              By continuing, you agree to the Ordinex{' '}
              <Link to="/terms" className="link-inline">Terms of Service</Link>
              . Fees are quoted by your lawyer after reviewing your case.
              Pay only in Ordinex. Funds are held until the session ends; 15% is the platform fee and 85% is paid to the lawyer after the consult. Do not send GCash to the lawyer’s personal wallet. If a problem or cancellation occurs, you are refunded.
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
};

export default CheckoutPage;
