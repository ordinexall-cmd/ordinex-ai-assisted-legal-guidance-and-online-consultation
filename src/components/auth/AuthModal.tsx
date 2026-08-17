import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/userFacingError';
import { PasswordInput } from '../PasswordInput';
import { Modal } from '../ui/Modal';
import { BrandLogo } from '../brand/BrandLogo';
import { OtpCodeInput } from '../ui/OtpCodeInput';
import {
  formatPhilippinePhoneDisplay,
} from '../../utils/phonePhilippines';
import { GoogleSignInButton } from './GoogleSignInButton';
import { authApi } from '../../services/api';
import { getCitizenPostAuthPath } from '../../constants/guestDraft';
import {
  clearRememberedLogins,
  loadRememberedAccounts,
  loadRememberedLogin,
  removeRememberedLogin,
  type RememberedLogin,
  upsertRememberedLogin,
} from '../../utils/rememberedLogin';

export type AuthView =
  | 'login'
  | 'register'
  | 'otp'
  | 'forgot'
  | 'reset_code'
  | 'reset_security'
  | 'reset_password'
  | 'reset';

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
  const [rememberLogin, setRememberLogin] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<RememberedLogin[]>([]);
  const [savedPickerOpen, setSavedPickerOpen] = useState(false);
  const emailFieldRef = useRef<HTMLDivElement>(null);

  const [otpPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpTimer, setOtpTimer] = useState(300);

  const [forgotEmail, setForgotEmail] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [requiresSecurityAnswer, setRequiresSecurityAnswer] = useState(false);
  const [securityQuestionPrompt, setSecurityQuestionPrompt] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const navigate = useNavigate();
  const { login, verifyOtp, isAuthenticated, user } = useAuth();

  const clearForm = () => {
    setError('');
    setSuccessMsg('');
    setLoading(false);
    setLoginEmail('');
    setLoginPassword('');
    setSavedPickerOpen(false);
    setOtpCode('');
    setForgotEmail('');
    setResetEmail('');
    setResetCode('');
    setRequiresSecurityAnswer(false);
    setSecurityQuestionPrompt('');
    setSecurityAnswer('');
    setNewPassword('');
  };

  const refreshSavedAccounts = () => {
    setSavedAccounts(loadRememberedAccounts().accounts);
  };

  const applyRemembered = (saved: RememberedLogin, preferTab?: 'citizen' | 'lawyer') => {
    setLoginEmail(saved.email);
    setLoginPassword(saved.password);
    setRememberLogin(true);
    setAuthTab(preferTab || saved.tab);
    setSavedPickerOpen(false);
  };

  const hydrateRememberedLogin = (preferTab?: 'citizen' | 'lawyer') => {
    refreshSavedAccounts();
    const saved = loadRememberedLogin();
    if (!saved) {
      setRememberLogin(false);
      return;
    }
    applyRemembered(saved, preferTab);
  };

  const handleRemoveSaved = (email: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    removeRememberedLogin(email);
    refreshSavedAccounts();
    if (loginEmail.trim().toLowerCase() === email.trim().toLowerCase()) {
      setLoginPassword('');
      setRememberLogin(false);
    }
  };

  const handleClearAllSaved = () => {
    clearRememberedLogins();
    setSavedAccounts([]);
    setSavedPickerOpen(false);
    setRememberLogin(false);
  };

  useEffect(() => {
    if (!open) return;
    setAuthView(initialView);
    setAuthTab(initialTab);
    clearForm();
    if (initialView === 'login') hydrateRememberedLogin(initialTab);
    if (initialError) setError(initialError);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when modal opens
  }, [open, initialView, initialTab, initialError]);

  useEffect(() => {
    if (initialError) return;
    if (isAuthenticated && user) {
      if (user.role === 'LAWYER') {
        // Send unverified lawyers straight to the verification wizard.
        if (!user.isVerified) navigate('/settings?tab=verification');
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

  useEffect(() => {
    if (!savedPickerOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!emailFieldRef.current?.contains(e.target as Node)) {
        setSavedPickerOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSavedPickerOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [savedPickerOpen]);

  const switchView = (view: AuthView) => {
    clearForm();
    setAuthView(view);
    if (view === 'login') hydrateRememberedLogin();
  };

  const redirectAfterAuth = (usr: { role: string; isVerified?: boolean }) => {
    if (usr.role === 'LAWYER') {
      if (!usr.isVerified) navigate('/settings?tab=verification');
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
      if (rememberLogin) {
        upsertRememberedLogin({
          email: loginEmail,
          password: loginPassword,
          tab: authTab,
        });
      }
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
        navigate('/settings?tab=verification');
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
      const body = purpose === 'RESET_PASSWORD'
        ? { email: resetEmail, purpose }
        : { phone: otpPhone, purpose };
      await authApi.resendOtp(body);
      if (purpose === 'REGISTER') setOtpTimer(300);
      setOtpCode('');
      setSuccessMsg('A new verification code was sent to your email.');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not resend code.'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailClean = forgotEmail.trim().toLowerCase();
    if (!emailClean || !emailClean.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await authApi.forgotPassword({ email: emailClean });
      setResetEmail(emailClean);
      setResetCode('');
      setSecurityAnswer('');
      setRequiresSecurityAnswer(Boolean(res.requiresSecurityAnswer ?? res.hasSecurityQuestion));
      setSecurityQuestionPrompt('');
      setSuccessMsg('A 6-digit code has been sent to your email.');
      setAuthView('reset_code');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not start password reset. Check your email and try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSecurityAnswerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!securityAnswer.trim()) {
      setError('Please answer your security question.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await authApi.forgotPasswordVerifySecurity({
        email: resetEmail,
        securityAnswer: securityAnswer.trim(),
      });
      setSuccessMsg('Security answer verified. Set a new password.');
      setAuthView('reset_password');
    } catch (err) {
      setError(getErrorMessage(err, 'Incorrect security answer. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetCode.trim().length !== 6) {
      setError('Please enter the complete 6-digit code.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await authApi.verifyResetCode({
        email: resetEmail,
        code: resetCode.trim(),
      });
      setRequiresSecurityAnswer(Boolean(res.hasSecurityQuestion));
      setSecurityQuestionPrompt(res.securityQuestion || '');
      if (res.hasSecurityQuestion) {
        setSuccessMsg('Email verified. Answer your security question next.');
        setAuthView('reset_security');
      } else {
        setAuthView('reset_password');
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid or expired verification code.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await authApi.resetPassword({
        email: resetEmail,
        code: resetCode.trim(),
        securityAnswer: securityAnswer.trim() || undefined,
        newPassword,
      });
      setSuccessMsg('Password reset successfully! You can now log in.');
      setTimeout(() => switchView('login'), 2000);
    } catch (err) {
      setError(getErrorMessage(err, 'Password reset failed. Please check your details and try again.'));
      // If error mentions security question, jump back to security step
      if (err instanceof Error && err.message.toLowerCase().includes('security')) {
        setAuthView('reset_security');
      }
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
          <button type="button" className="landing-auth-muted-link" onClick={() => switchView('register')}>
            Back to register
          </button>
        </form>
      );
    }

    if (authView === 'forgot') {
      return (
        <form onSubmit={handleForgotPassword} className="landing-auth-stack">
          <div className="landing-auth-field">
            <label className={labelClass}>Email address</label>
            <input
              type="email"
              className={inputClass}
              placeholder="name@email.com"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          {error && <p className="landing-form-error">{error}</p>}
          {successMsg && <p className="landing-form-success">{successMsg}</p>}
          <button type="submit" disabled={loading} className="landing-submit">
            {loading ? 'Checking…' : 'Continue'}
          </button>
          <button type="button" className="landing-auth-muted-link" onClick={() => switchView('login')}>
            Back to log in
          </button>
        </form>
      );
    }

    if (authView === 'reset_code') {
      return (
        <form onSubmit={handleVerifyResetCode} className="landing-auth-stack">
          <div className="landing-auth-field">
            <label className={labelClass}>6-digit code from email</label>
            <OtpCodeInput value={resetCode} onChange={setResetCode} disabled={loading} />
          </div>
          {error && <p className="landing-form-error">{error}</p>}
          {successMsg && <p className="landing-form-success">{successMsg}</p>}
          <button type="submit" disabled={loading || resetCode.length !== 6} className="landing-submit">
            {loading ? 'Verifying…' : 'Continue'}
          </button>
          <button
            type="button"
            className="landing-auth-resend"
            disabled={loading}
            onClick={() => { void handleResendOtp('RESET_PASSWORD'); }}
          >
            Resend code to email
          </button>
          <button type="button" className="landing-auth-muted-link" onClick={() => setAuthView('forgot')}>
            Change email
          </button>
        </form>
      );
    }

    if (authView === 'reset_security') {
      return (
        <form onSubmit={handleSecurityAnswerSubmit} className="landing-auth-stack">
          <div className="landing-auth-field">
            <label className={labelClass}>Security Question</label>
            <div style={{
              padding: '11px 14px',
              background: 'var(--surface-sunken, #f4f6f8)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle, #e0e0e0)',
              margin: '4px 0 14px',
              fontSize: '13.5px',
              fontWeight: 600,
              color: 'var(--text-primary, #111827)'
            }}>
              {securityQuestionPrompt || 'What was the name of your first elementary school?'}
            </div>
            <label className={labelClass}>Your Secret Answer</label>
            <input
              type="text"
              className={inputClass}
              placeholder="Enter your secret answer"
              value={securityAnswer}
              onChange={(e) => setSecurityAnswer(e.target.value)}
              required
              autoFocus
            />
          </div>
          {error && <p className="landing-form-error">{error}</p>}
          <button type="submit" disabled={loading || !securityAnswer.trim()} className="landing-submit">
            {loading ? 'Verifying…' : 'Continue'}
          </button>
          <button type="button" className="landing-auth-muted-link" onClick={() => setAuthView('forgot')}>
            Back
          </button>
        </form>
      );
    }

    if (authView === 'reset_password' || authView === 'reset') {
      return (
        <form onSubmit={handleResetPassword} className="landing-auth-stack">
          <div className="landing-auth-field">
            <label className={labelClass}>New password</label>
            <PasswordInput
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              inputClassName={inputClass}
              required
              minLength={8}
              autoFocus
            />
          </div>
          {error && <p className="landing-form-error">{error}</p>}
          {successMsg && <p className="landing-form-success">{successMsg}</p>}
          <button type="submit" disabled={loading || newPassword.length < 8} className="landing-submit">
            {loading ? 'Saving…' : 'Save new password'}
          </button>
          {requiresSecurityAnswer && (
            <button type="button" className="landing-auth-muted-link" onClick={() => setAuthView('reset_security')}>
              Back to security question
            </button>
          )}
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
            Already have an account?{' '}
            <button type="button" className="landing-auth-link-inline" onClick={() => switchView('login')}>
              Log in
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
            Already have an account?{' '}
            <button type="button" className="landing-auth-link-inline" onClick={() => switchView('login')}>
              Log in
            </button>
          </p>
        </div>
      );
    }

    return (
      <form onSubmit={handleLogin}>
        <div className="landing-auth-stack">
          <div className="landing-auth-field landing-auth-field--email" ref={emailFieldRef}>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              placeholder="name@email.com"
              value={loginEmail}
              onChange={(e) => {
                setLoginEmail(e.target.value);
                if (savedAccounts.length > 0) setSavedPickerOpen(true);
              }}
              onFocus={() => {
                if (savedAccounts.length > 0) setSavedPickerOpen(true);
              }}
              className={inputClass}
              required
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={savedPickerOpen && savedAccounts.length > 0}
            />
            {savedPickerOpen && savedAccounts.length > 0 && (
              <ul className="landing-auth-saved__list" role="listbox" aria-label="Saved accounts">
                {savedAccounts.map((a) => (
                  <li key={a.email.toLowerCase()}>
                    <button
                      type="button"
                      className="landing-auth-saved__item"
                      role="option"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyRemembered(a)}
                    >
                      <span className="landing-auth-saved__email">{a.email}</span>
                      <span className="landing-auth-saved__tab">
                        {a.tab === 'lawyer' ? 'Lawyer' : 'Citizen'}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="landing-auth-saved__remove"
                      aria-label={`Remove ${a.email}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => handleRemoveSaved(a.email, e)}
                    >
                      <span className="material-symbols-outlined" aria-hidden>close</span>
                    </button>
                  </li>
                ))}
                {savedAccounts.length > 1 && (
                  <li className="landing-auth-saved__clear-row">
                    <button
                      type="button"
                      className="landing-auth-saved__clear"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleClearAllSaved}
                    >
                      Clear all saved
                    </button>
                  </li>
                )}
              </ul>
            )}
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
        <div className="landing-auth-login-meta">
          <label className="landing-auth-remember">
            <input
              type="checkbox"
              checked={rememberLogin}
              onChange={(e) => setRememberLogin(e.target.checked)}
            />
            <span>Save email and password</span>
          </label>
          <button type="button" className="landing-auth-forgot" onClick={() => switchView('forgot')}>
            Forgot password?
          </button>
        </div>
        {error && <p className="landing-form-error landing-form-error--center">{error}</p>}
        <button type="submit" disabled={loading} className="landing-submit">
          {loading ? 'Logging in…' : 'Log in'}
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
            Sign in
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
        : authView === 'forgot'
          ? 'Reset password'
          : authView === 'reset_code'
            ? 'Verify email code'
            : authView === 'reset_security'
              ? 'Security question'
              : authView === 'reset_password' || authView === 'reset'
                ? 'Set new password'
                : 'Welcome back';

  const modalSubtitle =
    authView === 'register'
      ? 'Takes a minute. You can fix typos later in settings.'
      : authView === 'otp'
        ? 'Paste the code we texted you.'
        : authView === 'login'
          ? 'Use the email and password from signup.'
          : authView === 'forgot'
            ? 'Enter the email on your Ordinex account. We send a code, then ask your security question.'
            : authView === 'reset_code'
              ? `Enter the 6-digit code sent to ${resetEmail || 'your email'}.`
              : authView === 'reset_security'
                ? 'Answer the security question you set during registration.'
                : authView === 'reset_password' || authView === 'reset'
                  ? 'Choose a strong new password with at least 8 characters.'
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
