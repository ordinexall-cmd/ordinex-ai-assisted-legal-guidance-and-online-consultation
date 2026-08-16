import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { RegisterKioskShell } from '../components/auth/RegisterKioskShell';
import { PhoneInput } from '../components/ui/PhoneInput';
import { OtpCodeInput } from '../components/ui/OtpCodeInput';
import { PasswordInput } from '../components/PasswordInput';
import { PasswordStrengthMeter } from '../components/ui/PasswordStrengthMeter';
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton';
import { PhilippineAddressSelector, type PhilippineAddressData } from '../components/ui/PhilippineAddressSelector';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';
import { getCitizenPostAuthPath } from '../constants/guestDraft';
import { getErrorMessage } from '../utils/userFacingError';
import {
  formatPhilippinePhoneDisplay,
  isValidPhilippinePhoneLocal,
  localPartToFullPhone,
} from '../utils/phonePhilippines';
import { detectPhilippineCarrier } from '../utils/telcoPrefix';
import { isDisposableEmail } from '../utils/disposableEmail';
import { SECURITY_QUESTIONS, CUSTOM_SECURITY_QUESTION_VALUE } from '../content/securityQuestions';

type Step = 'basics' | 'security' | 'otp' | 'done';

const WIZARD_STEPS = [
  { id: 'basics', label: '1. Basics' },
  { id: 'security', label: '2. Security' },
  { id: 'otp', label: '3. Verify' },
] as const;

const inputClass = 'landing-input';
const labelClass = 'landing-label';

export interface RegisterPageProps {
  readonly defaultRole?: 'CITIZEN' | 'LAWYER';
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ defaultRole }) => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { register, verifyOtp, isAuthenticated, user } = useAuth();

  const initialRole = useMemo<'CITIZEN' | 'LAWYER'>(() => {
    const roleParam = params.get('role')?.toUpperCase();
    if (roleParam === 'LAWYER' || roleParam === 'COUNSEL' || defaultRole === 'LAWYER') {
      return 'LAWYER';
    }
    return 'CITIZEN';
  }, [params, defaultRole]);

  // Step state
  const [step, setStep] = useState<Step>('basics');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 1. Basics
  const [role, setRole] = useState<'CITIZEN' | 'LAWYER'>(initialRole);
  const [titlePrefix, setTitlePrefix] = useState('Atty.');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [suffix, setSuffix] = useState('');
  const [email, setEmail] = useState('');
  const [practiceType, setPracticeType] = useState<'PRIVATE' | 'PUBLIC' | 'CORPORATE' | 'LEGAL_AID'>('PRIVATE');

  // Philippine Domicile / Practice Address
  const [addressData, setAddressData] = useState<Partial<PhilippineAddressData>>({
    region: '',
    province: '',
    city: '',
    barangay: '',
    streetAddress: '',
    zipCode: '',
    formattedAddress: '',
  });

  // 2. Security & Contact
  const [phoneLocal, setPhoneLocal] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState<string>(SECURITY_QUESTIONS[0]);
  const [customSecurityQuestion, setCustomSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [consent, setConsent] = useState(false);

  // 3. OTP Verification
  const [otpPhone, setOtpPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpTimer, setOtpTimer] = useState(300);

  const carrierInfo = useMemo(() => detectPhilippineCarrier(phoneLocal), [phoneLocal]);

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'LAWYER') {
        navigate(user.isVerified ? '/lawyer/dashboard' : '/settings?tab=verification', { replace: true });
      } else {
        navigate(getCitizenPostAuthPath(), { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    if (step !== 'otp' || otpTimer <= 0) return;
    const id = window.setInterval(() => setOtpTimer((t) => t - 1), 1000);
    return () => window.clearInterval(id);
  }, [step, otpTimer]);

  const activeStepIndex =
    step === 'basics' ? 0
      : step === 'security' ? 1
        : step === 'otp' ? 2
          : -1;

  const validateBasics = (): boolean => {
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please provide your legal First Name and Last Name.');
      return false;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return false;
    }
    if (isDisposableEmail(email)) {
      setError('Temporary / disposable emails are not permitted. Please use a permanent email.');
      return false;
    }
    if (!addressData.province || !addressData.city) {
      setError(
        role === 'LAWYER'
          ? 'Please select your practice Province and City for jurisdiction & IBP matching.'
          : 'Please select your domicile Province and City for court jurisdiction matching.'
      );
      return false;
    }
    setError('');
    return true;
  };

  const validateSecurity = (): boolean => {
    if (!isValidPhilippinePhoneLocal(phoneLocal)) {
      setError('Enter a valid Philippine mobile number: +63 then 9XX XXX XXXX.');
      return false;
    }
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return false;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter your password.');
      return false;
    }
    if (securityQuestion === CUSTOM_SECURITY_QUESTION_VALUE) {
      const custom = customSecurityQuestion.trim();
      if (custom.length < 10 || custom.length > 120) {
        setError('Write your own question in 10 to 120 characters.');
        return false;
      }
    }
    if (!securityAnswer.trim()) {
      setError('Please provide an answer for your secret security question (used for account recovery).');
      return false;
    }
    if (!consent) {
      setError('You must consent to data processing under the Data Privacy Act (RA 10173).');
      return false;
    }
    setError('');
    return true;
  };

  const submitRegister = async () => {
    if (!validateSecurity()) return;
    const phoneFull = localPartToFullPhone(phoneLocal);
    if (!phoneFull) {
      setError('Enter a valid Philippine mobile number.');
      return;
    }

    const computedName = role === 'LAWYER'
      ? `${titlePrefix} ${[firstName.trim(), middleName.trim(), lastName.trim(), suffix.trim()].filter(Boolean).join(' ')}`.trim()
      : [firstName.trim(), middleName.trim(), lastName.trim(), suffix.trim()].filter(Boolean).join(' ');

    setLoading(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        name: computedName,
        firstName: firstName.trim(),
        middleName: middleName.trim() || undefined,
        lastName: lastName.trim(),
        suffix: suffix.trim() || undefined,
        email: email.trim(),
        phone: phoneFull,
        password,
        role,
        region: addressData.region || null,
        province: addressData.province || null,
        city: addressData.city || null,
        barangay: addressData.barangay || null,
        streetAddress: addressData.streetAddress || null,
        zipCode: addressData.zipCode || null,
        address: addressData.formattedAddress || null,
        securityQuestion: securityQuestion === CUSTOM_SECURITY_QUESTION_VALUE
          ? customSecurityQuestion.trim()
          : securityQuestion,
        securityAnswer: securityAnswer.trim(),
      };

      if (role === 'LAWYER') {
        payload.practiceType = practiceType;
      }

      const { phone: returnedPhone } = await register(payload as any);

      setOtpPhone(returnedPhone);
      setOtpTimer(300);
      setOtpCode('');
      setStep('otp');
    } catch (err) {
      setError(getErrorMessage(err, 'Registration failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async () => {
    if (otpCode.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const verifiedUser = await verifyOtp(otpPhone, otpCode);
      setStep('done');
      window.setTimeout(() => {
        if (verifiedUser.role === 'LAWYER') {
          navigate(verifiedUser.isVerified ? '/lawyer/dashboard' : '/settings?tab=verification', { replace: true });
        } else {
          navigate(getCitizenPostAuthPath(), { replace: true });
        }
      }, 900);
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
      const { phone: returnedPhone } = await authApi.resendOtp({ phone: otpPhone, purpose: 'REGISTER' });
      setOtpPhone(returnedPhone || otpPhone);
      setOtpTimer(300);
      setOtpCode('');
      setSuccessMsg('A new verification code was sent to your email.');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not resend code.'));
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setError('');
    setSuccessMsg('');
    if (step === 'security') setStep('basics');
    else if (step === 'otp') setStep('security');
  };

  const handleNext = () => {
    if (step === 'basics') {
      if (!validateBasics()) return;
      setStep('security');
      return;
    }
    if (step === 'security') {
      void submitRegister();
      return;
    }
    if (step === 'otp') {
      void submitOtp();
    }
  };

  const mins = Math.floor(otpTimer / 60);
  const secs = otpTimer % 60;

  if (step === 'done') {
    return (
      <RegisterKioskShell
        steps={WIZARD_STEPS}
        activeStepIndex={2}
        kicker="Account Ready"
        title="Account verified!"
        subtitle={role === 'LAWYER' ? 'Opening your counsel portal…' : 'Opening your citizen workspace…'}
        showFooter={false}
      >
        <div className="reg-kiosk__done">
          <span className="material-symbols-outlined reg-kiosk__done-icon" aria-hidden>check_circle</span>
          <p className="reg-kiosk__subtitle">Welcome to Ordinex, {firstName || 'Counsel'}.</p>
        </div>
      </RegisterKioskShell>
    );
  }

  const titles: Record<Step, { title: string; subtitle: string }> = {
    basics: {
      title: role === 'LAWYER' ? 'Counsel Basics & Location' : 'Legal Identity & Domicile',
      subtitle: role === 'LAWYER'
        ? 'Select your account type, legal name, and principal Philippine practice location.'
        : 'Select your account type, full legal name, and Philippine domicile address.',
    },
    security: {
      title: 'Security & Recovery',
      subtitle: 'Create a strong password, add your mobile number, and set recovery questions.',
    },
    otp: {
      title: 'Verify Your Account',
      subtitle: `Enter the 6-digit verification code sent to ${email || `+63 ${formatPhilippinePhoneDisplay(otpPhone)}`}.`,
    },
    done: {
      title: 'Account Verified',
      subtitle: 'Welcome to Ordinex.',
    },
  };

  return (
    <RegisterKioskShell
      steps={WIZARD_STEPS}
      activeStepIndex={activeStepIndex}
      kicker="Account Registration"
      title={titles[step].title}
      subtitle={titles[step].subtitle}
      onBack={step === 'basics' ? undefined : handleBack}
      onNext={handleNext}
      nextLabel={
        step === 'basics'
          ? 'Continue to Security →'
          : step === 'security'
            ? (loading ? 'Creating Account…' : 'Create Account & Send Code')
            : (loading ? 'Verifying…' : 'Verify & Open Workspace')
      }
      nextDisabled={step === 'otp' && (otpCode.length !== 6 || otpTimer <= 0)}
      nextLoading={loading}
      backLabel="Back"
      role={role}
    >
      {/* ─── STEP 1: BASICS ─── */}
      {step === 'basics' && (
        <div className="reg-kiosk__form-grid">
          {/* Role Toggle Selector */}
          <div className="landing-auth-field">
            <label className={labelClass} style={{ marginBottom: '0.5rem', display: 'block' }}>
              I am registering as *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => { setRole('CITIZEN'); setError(''); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  border: role === 'CITIZEN' ? '2px solid #0f766e' : '1px solid #cbd5e1',
                  background: role === 'CITIZEN' ? '#f0fdfa' : '#ffffff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: '22px',
                    color: role === 'CITIZEN' ? '#0f766e' : '#64748b',
                    background: role === 'CITIZEN' ? '#ccfbf1' : '#f1f5f9',
                    padding: '6px',
                    borderRadius: '8px',
                  }}
                >
                  person
                </span>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem', color: role === 'CITIZEN' ? '#0f766e' : '#1e293b' }}>
                    Citizen / Client
                  </strong>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Legal assistance & bookings
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => { setRole('LAWYER'); setError(''); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  border: role === 'LAWYER' ? '2px solid #b45309' : '1px solid #cbd5e1',
                  background: role === 'LAWYER' ? '#fffbeb' : '#ffffff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: '22px',
                    color: role === 'LAWYER' ? '#b45309' : '#64748b',
                    background: role === 'LAWYER' ? '#fef3c7' : '#f1f5f9',
                    padding: '6px',
                    borderRadius: '8px',
                  }}
                >
                  gavel
                </span>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem', color: role === 'LAWYER' ? '#b45309' : '#1e293b' }}>
                    Attorney / Counsel
                  </strong>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Legal practice & consultations
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Legal Name Section */}
          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#334155', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {role === 'LAWYER' ? 'Counsel Legal Identity' : 'Citizen Legal Identity'}
            </h4>

            {role === 'LAWYER' && (
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div className="landing-auth-field">
                  <label className={labelClass}>Title</label>
                  <select
                    className={inputClass}
                    value={titlePrefix}
                    onChange={(e) => setTitlePrefix(e.target.value)}
                  >
                    <option value="Atty.">Atty.</option>
                    <option value="Dean">Dean</option>
                    <option value="Judge">Judge</option>
                    <option value="Justice">Justice</option>
                  </select>
                </div>
                <div className="landing-auth-field">
                  <label className={labelClass}>Practice Type</label>
                  <select
                    className={inputClass}
                    value={practiceType}
                    onChange={(e) => setPracticeType(e.target.value as any)}
                  >
                    <option value="PRIVATE">Private Practice</option>
                    <option value="PUBLIC">Public / Government (PAO)</option>
                    <option value="CORPORATE">In-House / Corporate</option>
                    <option value="LEGAL_AID">Legal Aid / NGO</option>
                  </select>
                </div>
              </div>
            )}

            <div className="reg-kiosk__form-grid reg-kiosk__form-grid--2">
              <div className="landing-auth-field">
                <label className={labelClass}>First name *</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="e.g. Juan"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  required
                />
              </div>
              <div className="landing-auth-field">
                <label className={labelClass}>Middle name / Initial</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="e.g. Santos"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  autoComplete="additional-name"
                />
              </div>
            </div>

            <div className="reg-kiosk__form-grid reg-kiosk__form-grid--2" style={{ marginTop: '0.75rem' }}>
              <div className="landing-auth-field">
                <label className={labelClass}>Last name *</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="e.g. Dela Cruz"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  required
                />
              </div>
              <div className="landing-auth-field">
                <label className={labelClass}>Suffix</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="e.g. Jr., III"
                  value={suffix}
                  onChange={(e) => setSuffix(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Email */}
          <div className="landing-auth-field">
            <label className={labelClass}>{role === 'LAWYER' ? 'Work / Law Office Email *' : 'Email Address *'}</label>
            <input
              type="email"
              className={inputClass}
              placeholder="name@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          {/* Address Section */}
          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: '#334155', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {role === 'LAWYER' ? 'Philippine Practice Office Location (PSGC)' : 'Philippine Domicile & Residence (PSGC)'}
            </h4>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#64748b' }}>
              {role === 'LAWYER'
                ? 'Used for IBP Chapter matching and local court jurisdiction.'
                : 'Used for Katarungang Pambarangay venue and local court jurisdiction.'}
            </p>
            <PhilippineAddressSelector
              value={addressData}
              onChange={setAddressData}
              labelClass={labelClass}
              inputClass={inputClass}
            />
          </div>

          <GoogleSignInButton role={role} />
        </div>
      )}

      {/* ─── STEP 2: SECURITY & CONTACT ─── */}
      {step === 'security' && (
        <div className="reg-kiosk__form-grid">
          <div className="landing-auth-field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className={labelClass}>Philippine Mobile Number *</label>
              {carrierInfo.isValidPrefix && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: '#059669',
                    background: '#ecfdf5',
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}
                >
                  {carrierInfo.carrier} Network
                </span>
              )}
            </div>
            <PhoneInput value={phoneLocal} onChange={setPhoneLocal} inputClassName={inputClass} />
            <p className="landing-auth-field-hint">+63 country code (Philippines mobile number).</p>
          </div>

          <div className="landing-auth-field">
            <label className={labelClass}>Create Password *</label>
            <PasswordInput
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              inputClassName={inputClass}
              minLength={8}
              autoComplete="new-password"
            />
            <PasswordStrengthMeter password={password} />
          </div>

          <div className="landing-auth-field">
            <label className={labelClass}>Confirm Password *</label>
            <PasswordInput
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              inputClassName={inputClass}
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <div className="landing-auth-field">
            <label className={labelClass}>Secret Security Question (for 2FA Account Recovery) *</label>
            <select
              className={inputClass}
              value={securityQuestion}
              onChange={(e) => setSecurityQuestion(e.target.value)}
            >
              {SECURITY_QUESTIONS.map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
              <option value={CUSTOM_SECURITY_QUESTION_VALUE}>Write your own question…</option>
            </select>
          </div>

          {securityQuestion === CUSTOM_SECURITY_QUESTION_VALUE && (
            <div className="landing-auth-field">
              <label className={labelClass}>Your custom question *</label>
              <input
                type="text"
                className={inputClass}
                placeholder="10–120 characters"
                value={customSecurityQuestion}
                minLength={10}
                maxLength={120}
                onChange={(e) => setCustomSecurityQuestion(e.target.value)}
              />
            </div>
          )}

          <div className="landing-auth-field">
            <label className={labelClass}>Secret Answer *</label>
            <input
              type="text"
              className={inputClass}
              placeholder="Answer only you know"
              value={securityAnswer}
              onChange={(e) => setSecurityAnswer(e.target.value)}
            />
            <p className="landing-auth-field-hint">Used to verify your identity if you ever lose your phone or reset your password.</p>
          </div>

          <label className="landing-consent" style={{ marginTop: '0.5rem' }}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              I agree to the Terms of Service and consent to data processing under Republic Act No. 10173 (Data Privacy Act of 2012).{' '}
              <Link to="/privacy" className="link-inline" target="_blank">Privacy Policy</Link>
            </span>
          </label>
        </div>
      )}

      {/* ─── STEP 3: OTP VERIFICATION ─── */}
      {step === 'otp' && (
        <div className="reg-kiosk__form-grid">
          <div className="landing-auth-field">
            <label className={labelClass}>6-Digit Verification Code</label>
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

export default RegisterPage;
