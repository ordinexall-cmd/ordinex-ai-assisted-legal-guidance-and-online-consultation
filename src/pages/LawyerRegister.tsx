import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { RegisterKioskShell } from '../components/auth/RegisterKioskShell';
import { PhoneInput } from '../components/ui/PhoneInput';
import { OtpCodeInput } from '../components/ui/OtpCodeInput';
import { PasswordInput } from '../components/PasswordInput';
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton';
import { LawyerVerificationWizard } from '../components/settings/LawyerVerificationWizard';
import { useAuth } from '../context/AuthContext';
import {
  authApi,
  clearKycToken,
  getKycToken,
  setKycToken,
  setPanelDemoSession,
  type UserProfile,
} from '../services/api';
import { getErrorMessage } from '../utils/userFacingError';
import {
  formatPhilippinePhoneDisplay,
  isValidPhilippinePhoneLocal,
  localPartToFullPhone,
} from '../utils/phonePhilippines';

type Step = 'basic_info' | 'security' | 'otp' | 'kyc' | 'submitted';

const WIZARD_STEPS = [
  { id: 'basic', label: 'Basics' },
  { id: 'security', label: 'Security' },
  { id: 'otp', label: 'Verify' },
  { id: 'kyc', label: 'Identity' },
] as const;

const PANEL_EMAIL = 'panel-lawyer@ordinex.demo';
const PANEL_PHONE_LOCAL = '9178888888';
const PANEL_PASSWORD = 'PanelDemo2026!';
const PANEL_NAME = 'Juan Dela Cruz';
const PANEL_DEMO_OTP = '000000';

const inputClass = 'landing-input';
const labelClass = 'landing-label';

export const LawyerRegister: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const panelMode = searchParams.get('panel') === '1';
  const phaseKyc = searchParams.get('phase') === 'kyc';
  const { register, isAuthenticated, user } = useAuth();

  const [step, setStep] = useState<Step>('basic_info');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [pendingUser, setPendingUser] = useState<UserProfile | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);

  const [otpPhone, setOtpPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpTimer, setOtpTimer] = useState(300);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  useEffect(() => {
    setPanelDemoSession(panelMode);
    return () => {
      if (!panelMode) setPanelDemoSession(false);
    };
  }, [panelMode]);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'LAWYER') {
      if (user.isVerified) navigate('/lawyer/dashboard', { replace: true });
      else if (step !== 'kyc' && step !== 'submitted') {
        navigate('/lawyer/register?phase=kyc', { replace: true });
      }
    } else if (isAuthenticated && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, user, navigate, step]);

  useEffect(() => {
    if (phaseKyc && getKycToken()) {
      setStep('kyc');
    }
  }, [phaseKyc]);

  useEffect(() => {
    if (step !== 'otp' || otpTimer <= 0) return;
    const interval = setInterval(() => setOtpTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [step, otpTimer]);

  const fillPanelDemo = () => {
    setName(PANEL_NAME);
    setEmail(PANEL_EMAIL);
    setPhoneLocal(PANEL_PHONE_LOCAL);
    setPassword(PANEL_PASSWORD);
    setConsent(true);
  };

  const activeStepIndex =
    step === 'basic_info' ? 0
      : step === 'security' ? 1
        : step === 'otp' ? 2
          : step === 'kyc' ? 3
            : -1;

  const handleAccountSubmit = async () => {
    if (!consent) {
      setError('You must consent to data processing.');
      return;
    }
    if (!isValidPhilippinePhoneLocal(phoneLocal)) {
      setError('Enter a valid mobile number: +63 then 9XX XXX XXXX.');
      return;
    }
    const phoneFull = localPartToFullPhone(phoneLocal);
    if (!phoneFull) {
      setError('Enter a valid mobile number.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { phone, devOtp } = await register({
        name: name.trim(),
        email: email.trim(),
        phone: phoneFull,
        password,
        role: 'LAWYER',
      });
      setOtpPhone(phone);
      setOtpCode(panelMode ? PANEL_DEMO_OTP : (devOtp || ''));
      setDevOtpHint(devOtp || (panelMode ? PANEL_DEMO_OTP : null));
      setOtpTimer(300);
      setStep('otp');
      setSuccessMsg(panelMode ? 'Panel mode: use demo code 000000.' : '');
    } catch (err) {
      setError(getErrorMessage(err, 'Registration failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError('');
    setLoading(true);
    try {
      const response = await authApi.verifyOtp({ phone: otpPhone, code: otpCode });
      if (response.kycRequired && response.kycToken) {
        setKycToken(response.kycToken);
        setPendingUser(response.user);
        setSubmittedEmail(response.user.email);
        setStep('kyc');
      } else {
        setError('Unexpected response. Please try again.');
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Verification failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setLoading(true);
    try {
      const { phone, devOtp } = await authApi.resendOtp({ phone: otpPhone, purpose: 'REGISTER' });
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

  const handleKycComplete = () => {
    clearKycToken();
    setPanelDemoSession(false);
    setStep('submitted');
  };

  const handleBack = () => {
    setError('');
    if (step === 'basic_info') navigate('/register');
    else if (step === 'security') setStep('basic_info');
    else if (step === 'otp') setStep('security');
  };

  const handleNext = () => {
    if (step === 'basic_info') {
      if (!name.trim() || !email.trim()) {
        setError('Name and email are required.');
        return;
      }
      setError('');
      setStep('security');
      return;
    }
    if (step === 'security') {
      void handleAccountSubmit();
      return;
    }
    if (step === 'otp') {
      void handleVerifyOtp();
    }
  };

  const mins = Math.floor(otpTimer / 60);
  const secs = otpTimer % 60;

  const kycUser = pendingUser ?? ({
    id: '',
    name,
    email: submittedEmail || email,
    role: 'LAWYER',
    isVerified: false,
  } as UserProfile);

  const titles: Record<Step, { title: string; subtitle: string }> = {
    basic_info: {
      title: 'Counsel basics',
      subtitle: 'Your legal name and work email.',
    },
    security: {
      title: 'Security & contact',
      subtitle: 'Phone and password for your counsel account.',
    },
    otp: {
      title: 'Verify your phone',
      subtitle: `Enter the 6-digit code sent to +63 ${formatPhilippinePhoneDisplay(otpPhone)}.`,
    },
    kyc: {
      title: 'Verify your identity',
      subtitle: 'SC Roll, government ID, and a photo holding that ID with a handwritten security code.',
    },
    submitted: {
      title: 'Application complete',
      subtitle: 'Check your email, then sign in when ready.',
    },
  };

  if (step === 'submitted') {
    return (
      <RegisterKioskShell
        steps={WIZARD_STEPS}
        activeStepIndex={-1}
        kicker="Lawyer registration"
        title={titles.submitted.title}
        subtitle={titles.submitted.subtitle}
        showFooter
        hideBack
        onNext={() => navigate('/', { state: { openLogin: true, lawyerVerifiedPendingLogin: true } })}
        nextLabel="Go to sign in"
      >
        <div className="reg-kiosk__done">
          <span className="material-symbols-outlined reg-kiosk__done-icon" aria-hidden>mark_email_read</span>
          <p className="reg-kiosk__subtitle">
            We emailed <strong>{submittedEmail || email}</strong> when verification is approved.
          </p>
        </div>
      </RegisterKioskShell>
    );
  }

  const showWizardFooter = step !== 'kyc';

  return (
    <RegisterKioskShell
      steps={WIZARD_STEPS}
      activeStepIndex={activeStepIndex}
      kicker="Lawyer registration"
      title={titles[step].title}
      subtitle={titles[step].subtitle}
      wide={step === 'kyc'}
      showFooter={showWizardFooter}
      onBack={step === 'kyc' ? undefined : handleBack}
      onNext={step === 'kyc' ? undefined : handleNext}
      backLabel={step === 'basic_info' ? 'Choose role' : 'Back'}
      nextLabel={
        step === 'basic_info'
          ? 'Continue'
          : step === 'security'
            ? (loading ? 'Creating…' : 'Create account')
            : (loading ? 'Verifying…' : 'Verify & continue')
      }
      nextDisabled={step === 'otp' && (otpCode.length !== 6 || otpTimer <= 0)}
      nextLoading={loading}
    >
      {panelMode && (
        <div className="panel-demo-banner" role="status" style={{ marginBottom: '0.85rem' }}>
          Panel walkthrough — sample data can be pre-filled.
        </div>
      )}

      {step === 'basic_info' && (
        <div className="reg-kiosk__form-grid">
          {panelMode && (
            <button type="button" className="ox-btn ox-btn-secondary" onClick={fillPanelDemo}>
              Fill demo data
            </button>
          )}
          <div className="landing-auth-field">
            <label className={labelClass}>Full legal name</label>
            <input
              type="text"
              className={inputClass}
              placeholder="Atty. Juan Dela Cruz"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="landing-auth-field">
            <label className={labelClass}>Email</label>
            <input
              type="email"
              className={inputClass}
              placeholder="name@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <GoogleSignInButton role="LAWYER" />
          <p className="landing-auth-footer">
            Citizen instead? <Link to="/register?start=1" className="landing-auth-link-inline">Citizen registration</Link>
          </p>
        </div>
      )}

      {step === 'security' && (
        <div className="reg-kiosk__form-grid">
          <div className="landing-auth-field">
            <label className={labelClass}>Phone</label>
            <PhoneInput value={phoneLocal} onChange={setPhoneLocal} inputClassName={inputClass} />
            <p className="landing-auth-field-hint">+63 country code (Philippines).</p>
          </div>
          <div className="landing-auth-field">
            <label className={labelClass}>Password</label>
            <PasswordInput
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              inputClassName={inputClass}
              minLength={8}
            />
          </div>
          <label className="landing-consent">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              I agree to how Ordinex handles personal data under the Data Privacy Act (RA 10173).{' '}
              <Link to="/privacy" className="link-inline">Privacy Policy</Link>
            </span>
          </label>
        </div>
      )}

      {step === 'otp' && (
        <div className="reg-kiosk__form-grid">
          {devOtpHint && (
            <p className="landing-dev-otp" role="status">
              Dev code: <strong>{devOtpHint}</strong>
            </p>
          )}
          <div className="landing-auth-field">
            <label className={labelClass}>6-digit code</label>
            <OtpCodeInput value={otpCode} onChange={setOtpCode} disabled={loading || otpTimer <= 0} />
          </div>
          <p className="landing-auth-hint landing-auth-hint--center">
            {otpTimer > 0 ? `Expires in ${mins}:${secs.toString().padStart(2, '0')}` : 'Code expired.'}
          </p>
          {panelMode && (
            <button
              type="button"
              className="ox-btn ox-btn-secondary"
              onClick={() => { setOtpCode(PANEL_DEMO_OTP); setDevOtpHint(PANEL_DEMO_OTP); }}
            >
              Continue with demo code
            </button>
          )}
          {successMsg && <p className="landing-form-success landing-form-success--center">{successMsg}</p>}
          <button type="button" className="landing-auth-resend" disabled={loading} onClick={() => { void handleResendOtp(); }}>
            Resend code
          </button>
        </div>
      )}

      {step === 'kyc' && getKycToken() && (
        <div className="lawyer-register-kyc">
          <p className="landing-auth-field-hint" style={{ marginBottom: '0.85rem' }}>
            Use roll <strong>12345</strong> and name <strong>Juan Dela Cruz</strong> in dev, or your real SC Roll entry.
          </p>
          <LawyerVerificationWizard
            user={kycUser}
            variant="page"
            useKycToken
            panelMode={panelMode}
            applicantEmail={submittedEmail || email}
            onUpdated={() => {}}
            onVerified={handleKycComplete}
          />
        </div>
      )}

      {error && <p className="landing-form-error" style={{ marginTop: '0.85rem' }}>{error}</p>}
    </RegisterKioskShell>
  );
};

export default LawyerRegister;
