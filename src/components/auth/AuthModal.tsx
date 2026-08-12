import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/userFacingError';
import { PasswordInput } from '../PasswordInput';
import { Modal } from '../ui/Modal';
import { BrandLogo } from '../brand/BrandLogo';
import { PhoneInput } from '../ui/PhoneInput';
import { OtpCodeInput } from '../ui/OtpCodeInput';
import {
  localPartToFullPhone,
  isValidPhilippinePhoneLocal,
  formatPhilippinePhoneDisplay,
} from '../../utils/phonePhilippines';
import { GoogleSignInButton } from './GoogleSignInButton';
import { authApi } from '../../services/api';
import { getCitizenPostAuthPath } from '../../constants/guestDraft';

export type AuthView = 'login' | 'register' | 'otp' | 'forgot' | 'reset';

const inputClass = 'landing-input';
const labelClass = 'landing-label';

export interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  initialView?: AuthView;
  initialTab?: 'citizen' | 'lawyer';
  initialError?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  open,
  onClose,
  initialView = 'login',
  initialTab = 'citizen',
  initialError = '',
}) => {
  const [authTab, setAuthTab] = useState<'citizen' | 'lawyer'>(initialTab);
  const [authView, setAuthView] = useState<AuthView>(initialView);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [otpPhone, setOtpPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpTimer, setOtpTimer] = useState(300);

  const [forgotPhoneLocal, setForgotPhoneLocal] = useState('');
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const navigate = useNavigate();
  const { login, verifyOtp, isAuthenticated, user } = useAuth();

  const clearForm = () => {
    setError('');
    setSuccessMsg('');
    setLoading(false);
    setLoginEmail('');
    setLoginPassword('');
    setOtpCode('');
    setForgotPhoneLocal('');
    setDevOtpHint(null);
    setResetCode('');
    setNewPassword('');
  };

  useEffect(() => {
    if (!open) return;
    setAuthView(initialView);
    setAuthTab(initialTab);
    clearForm();
    if (initialError) setError(initialError);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when modal opens
  }, [open, initialView, initialTab, initialError]);

  useEffect(() => {
    if (initialError) return;
    if (isAuthenticated && user) {
      if (user.role === 'LAWYER') {
        // Send unverified lawyers straight to the verification wizard.
        if (!user.isVerified) navigate('/lawyer/register?phase=kyc');
        else navigate('/lawyer/dashboard');
      } else {
        navigate(getCitizenPostAuthPath());
      }
    }
  }, [isAuthenticated, user, navigate, initialError]);

  useEffect(() => {
    if (authView !== 'otp' || otpTimer <= 0) return;
    const interval = setInterval(() => setOtpTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [authView, otpTimer]);

  const switchView = (view: AuthView) => {
    clearForm();
    setAuthView(view);
  };

  const redirectAfterAuth = (usr: { role: string; isVerified?: boolean }) => {
    if (usr.role === 'LAWYER') {
      if (!usr.isVerified) navigate('/lawyer/register?phase=kyc');
      else navigate('/lawyer/dashboard');
    } else {
      navigate(getCitizenPostAuthPath());
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const usr = await login(loginEmail, loginPassword);
      redirectAfterAuth(usr);
    } catch (err) {
      setError(getErrorMessage(err, 'Login failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const usr = await verifyOtp(otpPhone, otpCode);
      if (usr.role === 'LAWYER') {
        navigate('/lawyer/register?phase=kyc');
      } else {
        navigate(getCitizenPostAuthPath());
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Verification failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async (purpose: 'REGISTER' | 'RESET_PASSWORD' = 'REGISTER') => {
    setError('');
    setLoading(true);
    try {
      const { phone, devOtp } = await authApi.resendOtp({ phone: otpPhone, purpose });
      setOtpPhone(phone);
      setOtpTimer(300);
      if (devOtp) {
        setOtpCode(devOtp);
        setDevOtpHint(devOtp);
      }
      setSuccessMsg('A new code was sent.');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not resend code.'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPhilippinePhoneLocal(forgotPhoneLocal)) {
      setError('Enter a valid mobile number.');
      return;
    }
    const phoneFull = localPartToFullPhone(forgotPhoneLocal);
    if (!phoneFull) {
      setError('Enter a valid mobile number.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { devOtp } = await authApi.forgotPassword({ phone: phoneFull });
      setSuccessMsg('If an account exists, a code has been sent.');
      setOtpPhone(phoneFull);
      if (devOtp) {
        setResetCode(devOtp);
        setDevOtpHint(devOtp);
      }
      setAuthView('reset');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not send verification code. Check your number and try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.resetPassword({ phone: otpPhone, code: resetCode, newPassword });
      setSuccessMsg('Password reset! You can now sign in.');
      setTimeout(() => switchView('login'), 2000);
    } catch (err) {
      setError(getErrorMessage(err, 'Password reset failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const renderAuthContent = () => {
    if (authView === 'otp') {
      const mins = Math.floor(otpTimer / 60);
      const secs = otpTimer % 60;
      return (
        <form onSubmit={handleVerifyOtp}>
          <div className="landing-auth-heading">
            <h3>Verify your phone</h3>
            <p className="landing-auth-hint">
              Code sent to +63 {formatPhilippinePhoneDisplay(otpPhone)}
            </p>
          </div>
          {devOtpHint && (
            <p className="landing-dev-otp" role="status">
              Dev code: <strong>{devOtpHint}</strong> (also in server console)
            </p>
          )}
          <div className="landing-auth-field">
            <label className={labelClass}>6-digit code</label>
            <OtpCodeInput value={otpCode} onChange={setOtpCode} disabled={loading || otpTimer <= 0} />
          </div>
          <p className="landing-auth-hint landing-auth-hint--center">
            {otpTimer > 0
              ? `Expires in ${mins}:${secs.toString().padStart(2, '0')}`
              : 'Code expired.'}
          </p>
          {error && <p className="landing-form-error landing-form-error--center">{error}</p>}
          {successMsg && <p className="landing-form-success landing-form-success--center">{successMsg}</p>}
          <button type="submit" disabled={loading || otpCode.length !== 6 || otpTimer <= 0} className="landing-submit">
            {loading ? 'Verifying…' : 'Verify and create account'}
          </button>
          <button
            type="button"
            className="landing-auth-resend"
            disabled={loading}
            onClick={() => { void handleResendOtp('REGISTER'); }}
          >
            Resend code
          </button>
          <p className="landing-auth-muted-link" onClick={() => switchView('register')}>
            ← Back to register
          </p>
        </form>
      );
    }

    if (authView === 'forgot') {
      return (
        <form onSubmit={handleForgotPassword}>
          <div className="landing-auth-heading">
            <h3>Reset password</h3>
            <p className="landing-auth-hint">We will text a code to the number on your account.</p>
          </div>
          <div className="landing-auth-field">
            <label className={labelClass}>Phone number</label>
            <PhoneInput
              value={forgotPhoneLocal}
              onChange={setForgotPhoneLocal}
              inputClassName={inputClass}
              required
            />
          </div>
          {error && <p className="landing-form-error">{error}</p>}
          {successMsg && <p className="landing-form-success">{successMsg}</p>}
          <button type="submit" disabled={loading} className="landing-submit">
            {loading ? 'Sending…' : 'Send code'}
          </button>
          <p className="landing-auth-muted-link" onClick={() => switchView('login')}>
            ← Back to sign in
          </p>
        </form>
      );
    }

    if (authView === 'reset') {
      return (
        <form onSubmit={handleResetPassword}>
          <div className="landing-auth-heading">
            <h3>Pick a new password</h3>
          </div>
          <div className="landing-auth-stack">
            <div className="landing-auth-field">
              <label className={labelClass}>Code from SMS</label>
              <OtpCodeInput value={resetCode} onChange={setResetCode} disabled={loading} />
            </div>
            <div className="landing-auth-field">
              <label className={labelClass}>New password</label>
              <PasswordInput
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                inputClassName={inputClass}
                required
                minLength={8}
              />
            </div>
          </div>
          {error && <p className="landing-form-error">{error}</p>}
          {successMsg && <p className="landing-form-success">{successMsg}</p>}
          <button type="submit" disabled={loading} className="landing-submit">
            {loading ? 'Saving…' : 'Save password'}
          </button>
        </form>
      );
    }

    if (authView === 'register' && authTab === 'lawyer') {
      return (
        <div className="landing-auth-stack">
          <div className="landing-auth-heading">
            <h3>Register as counsel</h3>
            <p className="landing-auth-hint">
              Multi-step registration: basics, security, phone verification, then identity check.
            </p>
          </div>
          <Link
            to="/lawyer/register"
            className="landing-submit"
            style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
            onClick={onClose}
          >
            Continue to lawyer registration
          </Link>
          <GoogleSignInButton role="LAWYER" />
          <p className="landing-auth-footer">
            Already registered?{' '}
            <button type="button" className="landing-auth-link-inline" onClick={() => switchView('login')}>
              Sign in
            </button>
          </p>
        </div>
      );
    }

    if (authView === 'register') {
      return (
        <div className="landing-auth-stack">
          <div className="landing-auth-heading">
            <h3>Create a citizen account</h3>
            <p className="landing-auth-hint">
              Multi-step registration on a dedicated page: account, profile, then phone verification.
            </p>
          </div>
          <Link
            to="/register?start=1"
            className="landing-submit"
            style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
            onClick={onClose}
          >
            Continue to registration
          </Link>
          <GoogleSignInButton role="CITIZEN" />
          <p className="landing-auth-footer">
            Already registered?{' '}
            <button type="button" className="landing-auth-link-inline" onClick={() => switchView('login')}>
              Sign in
            </button>
          </p>
        </div>
      );
    }

    return (
      <form onSubmit={handleLogin}>
        <div className="landing-auth-stack">
          <div className="landing-auth-field">
            <label className={labelClass}>Email</label>
            <input
              type="email"
              placeholder="name@email.com"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              className={inputClass}
              required
              autoComplete="email"
            />
          </div>
          <div className="landing-auth-field">
            <label className={labelClass}>Password</label>
            <PasswordInput
              placeholder="••••••••"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              inputClassName={inputClass}
              required
              autoComplete="current-password"
            />
          </div>
        </div>
        <button type="button" className="landing-auth-forgot" onClick={() => switchView('forgot')}>
          Forgot password?
        </button>
        {error && <p className="landing-form-error landing-form-error--center">{error}</p>}
        <button type="submit" disabled={loading} className="landing-submit">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <GoogleSignInButton role={authTab === 'lawyer' ? 'LAWYER' : 'CITIZEN'} />
        <p className="landing-auth-footer">
          New here?{' '}
          <button
            type="button"
            className="landing-auth-link-inline"
            onClick={() => {
              onClose();
              navigate(authTab === 'lawyer' ? '/lawyer/register' : '/register');
            }}
          >
            Create an account
          </button>
        </p>
      </form>
    );
  };

  const modalTitle =
    authView === 'otp'
      ? 'Verify phone'
      : authView === 'register'
        ? 'Create an account'
        : authView === 'forgot' || authView === 'reset'
          ? 'Reset password'
          : 'Welcome back';

  const modalSubtitle =
    authView === 'register'
      ? 'Takes a minute. You can fix typos later in settings.'
      : authView === 'otp'
        ? 'Paste the code we texted you.'
        : authView === 'login'
          ? 'Use the email and password from signup.'
          : authView === 'forgot'
            ? 'We will send a short code by SMS.'
            : authView === 'reset'
              ? 'Choose a new password, then sign in as usual.'
              : '';

  return (
    <Modal open={open} onClose={onClose} size="md" title={modalTitle}>
      <div className="auth-modal-accent" aria-hidden />
      <div className="auth-modal-brand">
        <BrandLogo size="md" variant="onLight" />
      </div>
      <p className="auth-modal-subtitle">{modalSubtitle}</p>
      {(authView === 'login' || authView === 'register') && (
        <div className="auth-tabs">
          <button type="button" data-active={authTab === 'citizen' ? 'true' : 'false'} onClick={() => setAuthTab('citizen')}>
            Citizen
          </button>
          <button type="button" data-active={authTab === 'lawyer' ? 'true' : 'false'} onClick={() => setAuthTab('lawyer')}>
            Lawyer
          </button>
        </div>
      )}
      {renderAuthContent()}
    </Modal>
  );
};
