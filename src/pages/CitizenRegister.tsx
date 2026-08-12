import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { RegisterKioskShell } from '../components/auth/RegisterKioskShell';
import { PhoneInput } from '../components/ui/PhoneInput';
import { OtpCodeInput } from '../components/ui/OtpCodeInput';
import { PasswordInput } from '../components/PasswordInput';
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';
import { getCitizenPostAuthPath } from '../constants/guestDraft';
import { getErrorMessage } from '../utils/userFacingError';
import {
  formatPhilippinePhoneDisplay,
  isValidPhilippinePhoneLocal,
  localPartToFullPhone,
} from '../utils/phonePhilippines';

type Phase = 'hub' | 'account' | 'profile' | 'otp' | 'done';

const WIZARD_STEPS = [
  { id: 'account', label: 'Account' },
  { id: 'profile', label: 'Profile' },
  { id: 'otp', label: 'Verify' },
] as const;

const inputClass = 'landing-input';
const labelClass = 'landing-label';

export const CitizenRegister: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const startCitizen = params.get('role') === 'citizen' || params.get('start') === '1';
  const { register, verifyOtp, isAuthenticated, user } = useAuth();

  const [phase, setPhase] = useState<Phase>(startCitizen ? 'account' : 'hub');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [password, setPassword] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [address, setAddress] = useState('');
  const [civilStatus, setCivilStatus] = useState('');
  const [occupation, setOccupation] = useState('');
  const [consent, setConsent] = useState(false);

  const [otpPhone, setOtpPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpTimer, setOtpTimer] = useState(300);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'LAWYER') {
        navigate(user.isVerified ? '/lawyer/dashboard' : '/lawyer/register?phase=kyc', { replace: true });
      } else {
        navigate(getCitizenPostAuthPath(), { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    if (phase !== 'otp' || otpTimer <= 0) return;
    const id = window.setInterval(() => setOtpTimer((t) => t - 1), 1000);
    return () => window.clearInterval(id);
  }, [phase, otpTimer]);

  const activeStepIndex =
    phase === 'account' ? 0 : phase === 'profile' ? 1 : phase === 'otp' ? 2 : -1;

  const validateAccount = (): boolean => {
    if (!name.trim() || !email.trim() || !password || password.length < 8) {
      setError('Enter your name, email, and a password with at least 8 characters.');
      return false;
    }
    if (!isValidPhilippinePhoneLocal(phoneLocal)) {
      setError('Enter a valid mobile number: +63 then 9XX XXX XXXX.');
      return false;
    }
    setError('');
    return true;
  };

  const validateProfile = (): boolean => {
    if (!dob || !gender || !address.trim() || !civilStatus || !occupation.trim()) {
      setError('All profile details are required.');
      return false;
    }
    if (!consent) {
      setError('You must consent to data processing under RA 10173.');
      return false;
    }
    setError('');
    return true;
  };

  const submitRegister = async () => {
    if (!validateProfile()) return;
    const phoneFull = localPartToFullPhone(phoneLocal);
    if (!phoneFull) {
      setError('Enter a valid mobile number.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { phone, devOtp } = await register({
        name: name.trim(),
        email: email.trim(),
        phone: phoneFull,
        password,
        role: 'CITIZEN',
        dob,
        gender,
        address: address.trim(),
        civilStatus,
        occupation: occupation.trim(),
      } as Parameters<typeof register>[0]);
      setOtpPhone(phone);
      setOtpTimer(300);
      setOtpCode(devOtp || '');
      setDevOtpHint(devOtp || null);
      setPhase('otp');
    } catch (err) {
      setError(getErrorMessage(err, 'Registration failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async () => {
    if (otpCode.length !== 6) {
      setError('Enter the 6-digit code.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await verifyOtp(otpPhone, otpCode);
      setPhase('done');
      window.setTimeout(() => navigate(getCitizenPostAuthPath()), 900);
    } catch (err) {
      setError(getErrorMessage(err, 'Verification failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    setLoading(true);
    setError('');
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

  const handleBack = () => {
    setError('');
    setSuccessMsg('');
    if (phase === 'account') setPhase('hub');
    else if (phase === 'profile') setPhase('account');
    else if (phase === 'otp') setPhase('profile');
  };

  const handleNext = () => {
    if (phase === 'account') {
      if (!validateAccount()) return;
      setPhase('profile');
      return;
    }
    if (phase === 'profile') {
      void submitRegister();
      return;
    }
    if (phase === 'otp') {
      void submitOtp();
    }
  };

  const mins = Math.floor(otpTimer / 60);
  const secs = otpTimer % 60;

  if (phase === 'hub') {
    return (
      <RegisterKioskShell
        steps={WIZARD_STEPS}
        activeStepIndex={-1}
        kicker="Get started"
        title="Create your Ordinex account"
        subtitle="Choose how you will use the platform. Both paths are free to register."
        showFooter={false}
      >
        <div className="reg-kiosk__hub">
          <button
            type="button"
            className="reg-kiosk__hub-option"
            onClick={() => { setPhase('account'); setError(''); }}
          >
            <span className="reg-kiosk__hub-option-icon material-symbols-outlined" aria-hidden>person</span>
            <span>
              <strong>I need legal help</strong>
              <span>Citizen account — AI analysis, lawyer directory, and booking.</span>
            </span>
          </button>
          <Link to="/lawyer/register" className="reg-kiosk__hub-option">
            <span className="reg-kiosk__hub-option-icon material-symbols-outlined" aria-hidden>gavel</span>
            <span>
              <strong>I am a lawyer</strong>
              <span>Counsel account — verification, schedule, and consultations.</span>
            </span>
          </Link>
        </div>
        <p className="landing-auth-footer" style={{ marginTop: '1.25rem' }}>
          Already have an account?{' '}
          <Link to="/" className="landing-auth-link-inline" state={{ openLogin: true }}>
            Sign in
          </Link>
        </p>
      </RegisterKioskShell>
    );
  }

  if (phase === 'done') {
    return (
      <RegisterKioskShell
        steps={WIZARD_STEPS}
        activeStepIndex={2}
        kicker="Almost there"
        title="Phone verified"
        subtitle="Opening your dashboard…"
        showFooter={false}
      >
        <div className="reg-kiosk__done">
          <span className="material-symbols-outlined reg-kiosk__done-icon" aria-hidden>check_circle</span>
          <p className="reg-kiosk__subtitle">Welcome, {name.split(' ')[0] || 'there'}.</p>
        </div>
      </RegisterKioskShell>
    );
  }

  const titles = {
    account: {
      title: 'Account details',
      subtitle: 'Name, email, phone, and password for your citizen account.',
    },
    profile: {
      title: 'Profile details',
      subtitle: 'Helps lawyers understand who they are speaking with.',
    },
    otp: {
      title: 'Verify your phone',
      subtitle: `Enter the 6-digit code sent to +63 ${formatPhilippinePhoneDisplay(otpPhone)}.`,
    },
  } as const;

  const meta = titles[phase as 'account' | 'profile' | 'otp'];

  return (
    <RegisterKioskShell
      steps={WIZARD_STEPS}
      activeStepIndex={activeStepIndex}
      kicker="Citizen registration"
      title={meta.title}
      subtitle={meta.subtitle}
      onBack={handleBack}
      onNext={handleNext}
      nextLabel={
        phase === 'account'
          ? 'Continue'
          : phase === 'profile'
            ? (loading ? 'Creating…' : 'Create account')
            : (loading ? 'Verifying…' : 'Verify & finish')
      }
      nextDisabled={phase === 'otp' && (otpCode.length !== 6 || otpTimer <= 0)}
      nextLoading={loading}
      backLabel={phase === 'account' ? 'Choose role' : 'Back'}
    >
      {phase === 'account' && (
        <div className="reg-kiosk__form-grid">
          <div className="landing-auth-field">
            <label className={labelClass}>Full name</label>
            <input
              type="text"
              className={inputClass}
              placeholder="Juan Dela Cruz"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
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
              autoComplete="email"
            />
          </div>
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
              autoComplete="new-password"
            />
          </div>
          <GoogleSignInButton role="CITIZEN" />
        </div>
      )}

      {phase === 'profile' && (
        <div className="reg-kiosk__form-grid">
          <div className="reg-kiosk__form-grid reg-kiosk__form-grid--2">
            <div className="landing-auth-field">
              <label className={labelClass}>Date of birth</label>
              <input type="date" className={inputClass} value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>
            <div className="landing-auth-field">
              <label className={labelClass}>Gender</label>
              <select className={inputClass} value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="">Select…</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
          </div>
          <div className="landing-auth-field">
            <label className={labelClass}>Address (city / barangay)</label>
            <input
              type="text"
              className={inputClass}
              placeholder="e.g. Quezon City, Brgy. Fairview"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="reg-kiosk__form-grid reg-kiosk__form-grid--2">
            <div className="landing-auth-field">
              <label className={labelClass}>Civil status</label>
              <select className={inputClass} value={civilStatus} onChange={(e) => setCivilStatus(e.target.value)}>
                <option value="">Select…</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Separated">Separated</option>
                <option value="Widowed">Widowed</option>
              </select>
            </div>
            <div className="landing-auth-field">
              <label className={labelClass}>Occupation</label>
              <input
                type="text"
                className={inputClass}
                placeholder="e.g. Teacher, OFW"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
              />
            </div>
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

      {phase === 'otp' && (
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
          {successMsg && <p className="landing-form-success landing-form-success--center">{successMsg}</p>}
          <button type="button" className="landing-auth-resend" disabled={loading} onClick={() => { void resendOtp(); }}>
            Resend code
          </button>
        </div>
      )}

      {error && <p className="landing-form-error" style={{ marginTop: '0.85rem' }}>{error}</p>}
    </RegisterKioskShell>
  );
};

export default CitizenRegister;
