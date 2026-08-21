import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/shell/AppShell';
import { useAuth } from '../context/AuthContext';
import { getCitizenNav } from '../utils/citizenWorkspace';
import { getLawyerNav } from '../utils/lawyerWorkspace';
import { getAppBackFallback } from '../utils/navigation';
import { UserAvatar } from '../components/UserAvatar';
import { TrustScoreBadge } from '../components/ui/TrustScoreBadge';
import { authApi, profileApi } from '../services/api';
import { getErrorMessage } from '../utils/userFacingError';
import { PhilippineAddressSelector, type PhilippineAddressData } from '../components/ui/PhilippineAddressSelector';
import { LawyerVerificationWizard } from '../components/settings/LawyerVerificationWizard';
import { LawyerBookingSettings } from '../components/settings/LawyerBookingSettings';
import { LawyerEarningsTab } from '../components/settings/LawyerEarningsTab';
import { PaymentDestinationForm } from '../components/payment/PaymentDestinationForm';
import { RecycleBinPanel } from '../components/settings/RecycleBinPanel';
import { LawyerSpecializationsEditor } from '../components/settings/LawyerSpecializationsEditor';
import { CitizenVerificationPanel } from '../components/settings/CitizenVerificationPanel';
import { computeCitizenTrustScore, computeLawyerTrustScore, type TrustScoreResult } from '../utils/trustScore';
import { OtpCodeInput } from '../components/ui/OtpCodeInput';
import { PhoneInput } from '../components/ui/PhoneInput';
import { localPartToFullPhone } from '../utils/phonePhilippines';

type SettingsTab = 'profile' | 'verification' | 'security' | 'practice' | 'billing' | 'privacy';

export const AccountSettings: React.FC = () => {
  const { user, refreshUser, updateUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const isCitizen = user?.role === 'CITIZEN';
  const isLawyer = user?.role === 'LAWYER';
  const nav = isCitizen ? getCitizenNav(user) : getLawyerNav(user);

  // Active tab state
  const rawTab = searchParams.get('tab') as SettingsTab;
  const activeTab: SettingsTab = useMemo(() => {
    if (['profile', 'verification', 'security', 'practice', 'billing', 'privacy'].includes(rawTab)) {
      return rawTab;
    }
    return 'profile';
  }, [rawTab]);

  const setActiveTab = (tab: SettingsTab) => {
    setSearchParams({ tab });
  };

  // Feedback notifications
  const [msg, setMsg] = useState('');
  const [msgOk, setMsgOk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const setFeedback = (text: string, ok: boolean) => {
    setMsg(text);
    setMsgOk(ok);
    if (ok) setTimeout(() => setMsg(''), 5000);
  };

  // Form State: Profile & Identity
  const [name, setName] = useState(user?.name || '');
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [middleName, setMiddleName] = useState(user?.middleName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [suffix, setSuffix] = useState(user?.suffix || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [specializations, setSpecializations] = useState<string[]>(user?.specializations ?? []);
  const [consultationFeeMin, setConsultationFeeMin] = useState<number>(user?.consultationFeeMin || user?.consultationFee || 0);
  const [consultationFeeMax, setConsultationFeeMax] = useState<number>(user?.consultationFeeMax || user?.consultationFee || 0);

  // Address Data
  const [addressData, setAddressData] = useState<Partial<PhilippineAddressData>>({
    region: user?.region || '',
    province: user?.province || '',
    city: user?.city || '',
    barangay: user?.barangay || '',
    streetAddress: user?.streetAddress || '',
    zipCode: user?.zipCode || '',
    formattedAddress: user?.address || '',
  });

  // Citizen Demographics & ID
  const [dob, setDob] = useState(user?.dob || '');
  const [gender, setGender] = useState(user?.gender || '');
  const [citizenship, setCitizenship] = useState(user?.citizenship || 'Filipino');
  const [civilStatus, setCivilStatus] = useState(user?.civilStatus || '');
  const [occupation, setOccupation] = useState(user?.occupation || '');
  const [indigencyTier, setIndigencyTier] = useState(user?.indigencyTier || 'STANDARD');
  const [citizenIdType, setCitizenIdType] = useState(user?.citizenIdType || 'PHILID');
  const [citizenIdNumber, setCitizenIdNumber] = useState(user?.citizenIdNumber || '');
  const [emergencyContactName, setEmergencyContactName] = useState(user?.emergencyContactName || '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(user?.emergencyContactPhone || '');
  const [emergencyRelationship, setEmergencyRelationship] = useState(user?.emergencyRelationship || '');

  // Lawyer Bar Credentials
  const [barNumber, setBarNumber] = useState(user?.barNumber || '');
  const [barAdmissionYear, setBarAdmissionYear] = useState<number | ''>(user?.barAdmissionYear || '');
  const [ibpChapter, setIbpChapter] = useState(user?.ibpChapter || '');
  const [ibpIdNumber, setIbpIdNumber] = useState(user?.ibpIdNumber || '');
  const [ptrNumber, setPtrNumber] = useState(user?.ptrNumber || '');
  const [ptrLgu, setPtrLgu] = useState(user?.ptrLgu || '');
  const [mcleComplianceNo, setMcleComplianceNo] = useState(user?.mcleComplianceNo || '');
  const [lawFirmName, setLawFirmName] = useState(user?.lawFirmName || '');

  // Security Form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changeOtpCode, setChangeOtpCode] = useState('');
  const [passwordOtpSent, setPasswordOtpSent] = useState(false);
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailChangeOtp, setEmailChangeOtp] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [phoneCurrentPassword, setPhoneCurrentPassword] = useState('');
  const [newPhoneLocal, setNewPhoneLocal] = useState('');
  const [phoneChangeOtp, setPhoneChangeOtp] = useState('');
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [profileConfirmPassword, setProfileConfirmPassword] = useState('');

  // Sync state with user
  useEffect(() => {
    if (!user) return;
    setName(user.name || '');
    setFirstName(user.firstName || '');
    setMiddleName(user.middleName || '');
    setLastName(user.lastName || '');
    setSuffix(user.suffix || '');
    setBio(user.bio || '');
    setSpecializations(user.specializations ?? []);
    setConsultationFeeMin(user.consultationFeeMin || user.consultationFee || 0);
    setConsultationFeeMax(user.consultationFeeMax || user.consultationFee || 0);

    setDob(user.dob || '');
    setGender(user.gender || '');
    setCitizenship(user.citizenship || 'Filipino');
    setCivilStatus(user.civilStatus || '');
    setOccupation(user.occupation || '');
    setIndigencyTier(user.indigencyTier || 'STANDARD');
    setCitizenIdType(user.citizenIdType || 'PHILID');
    setCitizenIdNumber(user.citizenIdNumber || '');
    setEmergencyContactName(user.emergencyContactName || '');
    setEmergencyContactPhone(user.emergencyContactPhone || '');
    setEmergencyRelationship(user.emergencyRelationship || '');

    setAddressData({
      region: user.region || '',
      province: user.province || '',
      city: user.city || '',
      barangay: user.barangay || '',
      streetAddress: user.streetAddress || '',
      zipCode: user.zipCode || '',
      formattedAddress: user.address || '',
    });

    setBarNumber(user.barNumber || '');
    setBarAdmissionYear(user.barAdmissionYear || '');
    setIbpChapter(user.ibpChapter || '');
    setIbpIdNumber(user.ibpIdNumber || '');
    setPtrNumber(user.ptrNumber || '');
    setPtrLgu(user.ptrLgu || '');
    setMcleComplianceNo(user.mcleComplianceNo || '');
    setLawFirmName(user.lawFirmName || '');
  }, [user]);

  // Compute Trust Score
  const trustScoreResult = useMemo((): TrustScoreResult => {
    if (!user) {
      return { score: 0, maxScore: 100, level: 'UNVERIFIED', badgeLabel: '0 ID PROOF', badgeColor: '#94a3b8', checks: [] };
    }
    if (isLawyer) {
      return computeLawyerTrustScore({
        email: user.email,
        phone: user.phone,
        isVerified: user.isVerified,
        barNumber: barNumber || user.barNumber,
        ibpChapter: ibpChapter || user.ibpChapter,
        lawyerVerificationStatus: user.lawyerVerificationStatus,
        avatarUrl: user.avatarUrl,
        credentials: user.credentials,
        specializations: specializations || user.specializations,
      });
    }
    return computeCitizenTrustScore({
      email: user.email,
      phone: user.phone,
      name: name || user.name,
      address: addressData.formattedAddress || user.address,
      dob,
      civilStatus,
      citizenIdNumber,
      citizenVerificationStatus: user.citizenVerificationStatus,
      citizenSelfieUrl: user.citizenSelfieUrl,
      isVerified: user.isVerified,
      emergencyContactName,
      avatarUrl: user.avatarUrl,
    });
  }, [user, isLawyer, name, addressData.formattedAddress, dob, civilStatus, citizenIdNumber, emergencyContactName, barNumber, ibpChapter, specializations]);

  // Handle Avatar Upload
  const handleAvatar = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFeedback('Please upload a valid JPEG, PNG, or WebP image.', false);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFeedback('Image file must be under 5 MB.', false);
      return;
    }
    setAvatarBusy(true);
    setMsg('');
    try {
      const res = await profileApi.uploadAvatar(file);
      updateUser({ avatarUrl: res.avatarUrl });
      setFeedback('Profile photo updated successfully.', true);
    } catch (err) {
      setFeedback(getErrorMessage(err, 'Failed to upload photo.'), false);
    } finally {
      setAvatarBusy(false);
    }
  };

  // Handle Profile Save
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const computedName = [firstName.trim(), middleName.trim(), lastName.trim(), suffix.trim()].filter(Boolean).join(' ') || name.trim();

      const identityChanged =
        (firstName.trim() || '') !== (user?.firstName || '')
        || (middleName.trim() || '') !== (user?.middleName || '')
        || (lastName.trim() || '') !== (user?.lastName || '')
        || (isCitizen && (
          (dob || '') !== (user?.dob || '')
          || (citizenIdType || '') !== (user?.citizenIdType || '')
          || (citizenIdNumber.trim() || '') !== (user?.citizenIdNumber || '')
        ));

      const updates: Record<string, unknown> = {
        name: computedName,
        firstName: firstName.trim() || null,
        middleName: middleName.trim() || null,
        lastName: lastName.trim() || null,
        suffix: suffix.trim() || null,
        bio: bio.trim() || undefined,
        region: addressData.region || null,
        province: addressData.province || null,
        city: addressData.city || null,
        barangay: addressData.barangay || null,
        streetAddress: addressData.streetAddress || null,
        zipCode: addressData.zipCode || null,
        address: addressData.formattedAddress || null,
      };

      if (isCitizen) {
        updates.dob = dob || null;
        updates.gender = gender || null;
        updates.citizenship = citizenship || 'Filipino';
        updates.civilStatus = civilStatus || null;
        updates.occupation = occupation.trim() || null;
        updates.indigencyTier = indigencyTier || 'STANDARD';
        updates.citizenIdType = citizenIdType || null;
        updates.citizenIdNumber = citizenIdNumber.trim() || null;
        updates.emergencyContactName = emergencyContactName.trim() || null;
        updates.emergencyContactPhone = emergencyContactPhone.trim() || null;
        updates.emergencyRelationship = emergencyRelationship.trim() || null;
      }

      if (isLawyer) {
        updates.specializations = specializations;
        updates.consultationFee = consultationFeeMin;
        updates.consultationFeeMin = consultationFeeMin;
        updates.consultationFeeMax = Math.max(consultationFeeMin, consultationFeeMax);
        updates.barNumber = barNumber.trim() || null;
        updates.barAdmissionYear = barAdmissionYear ? Number(barAdmissionYear) : null;
        updates.ibpChapter = ibpChapter.trim() || null;
        updates.ibpIdNumber = ibpIdNumber.trim() || null;
        updates.ptrNumber = ptrNumber.trim() || null;
        updates.ptrLgu = ptrLgu.trim() || null;
        updates.mcleComplianceNo = mcleComplianceNo.trim() || null;
        updates.lawFirmName = lawFirmName.trim() || null;
      }

      if (identityChanged && profileConfirmPassword.trim()) {
        updates.currentPassword = profileConfirmPassword.trim();
      }

      await authApi.updateProfile(updates as any);
      await refreshUser();
      setProfileConfirmPassword('');
      setFeedback('Account details and profile saved successfully.', true);
    } catch (err) {
      setFeedback(getErrorMessage(err, 'Failed to save changes. Please try again.'), false);
    } finally {
      setSaving(false);
    }
  };

  const handleRequestPasswordOtp = async () => {
    if (!newPassword || newPassword.length < 8) {
      setFeedback('New password must be at least 8 characters.', false);
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedback('New passwords do not match.', false);
      return;
    }
    setSaving(true);
    setMsg('');
    try {
      await authApi.requestChangeOtp({
        purpose: 'CHANGE_PASSWORD',
      });
      setPasswordOtpSent(true);
      setChangeOtpCode('');
      setFeedback('Verification code sent to your account email.', true);
    } catch (err) {
      setFeedback(getErrorMessage(err, 'Could not send verification code.'), false);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordOtpSent) {
      await handleRequestPasswordOtp();
      return;
    }
    if (changeOtpCode.trim().length !== 6) {
      setFeedback('Enter the 6-digit verification code from your email.', false);
      return;
    }
    if (user?.securityQuestion && !securityAnswer.trim()) {
      setFeedback('Answer your security question.', false);
      return;
    }
    setSaving(true);
    setMsg('');
    try {
      const res = await authApi.changePassword({
        securityAnswer: securityAnswer.trim() || undefined,
        code: changeOtpCode.trim(),
        newPassword,
      });
      updateUser(res.user);
      setFeedback('Password updated successfully.', true);
      setNewPassword('');
      setConfirmPassword('');
      setSecurityAnswer('');
      setChangeOtpCode('');
      setPasswordOtpSent(false);
    } catch (err) {
      setFeedback(getErrorMessage(err, 'Failed to update password.'), false);
    } finally {
      setSaving(false);
    }
  };

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newEmail.trim()) {
      setFeedback('Current password and new email are required.', false);
      return;
    }
    if (!emailOtpSent) {
      setSaving(true);
      try {
        await authApi.requestChangeOtp({
          purpose: 'CHANGE_EMAIL',
          currentPassword,
          newEmail: newEmail.trim(),
        });
        setEmailOtpSent(true);
        setEmailChangeOtp('');
        setFeedback('Verification code sent to the new email address.', true);
      } catch (err) {
        setFeedback(getErrorMessage(err, 'Could not send verification code.'), false);
      } finally {
        setSaving(false);
      }
      return;
    }
    if (emailChangeOtp.trim().length !== 6) {
      setFeedback('Enter the 6-digit verification code from the new inbox.', false);
      return;
    }
    setSaving(true);
    try {
      const res = await authApi.changeEmail({
        currentPassword,
        code: emailChangeOtp.trim(),
        newEmail: newEmail.trim(),
      });
      updateUser(res.user);
      setFeedback('Email updated successfully.', true);
      setNewEmail('');
      setCurrentPassword('');
      setEmailChangeOtp('');
      setEmailOtpSent(false);
    } catch (err) {
      setFeedback(getErrorMessage(err, 'Failed to update email.'), false);
    } finally {
      setSaving(false);
    }
  };

  const handlePhoneChange = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullPhone = localPartToFullPhone(newPhoneLocal);
    if (!phoneCurrentPassword || !fullPhone) {
      setFeedback('Current password and a valid new mobile number are required.', false);
      return;
    }
    if (!phoneOtpSent) {
      setSaving(true);
      try {
        await authApi.requestChangeOtp({
          purpose: 'CHANGE_PHONE',
          currentPassword: phoneCurrentPassword,
          newPhone: fullPhone,
        });
        setPhoneOtpSent(true);
        setPhoneChangeOtp('');
        setFeedback('Verification code sent to your email.', true);
      } catch (err) {
        setFeedback(getErrorMessage(err, 'Could not send verification code.'), false);
      } finally {
        setSaving(false);
      }
      return;
    }
    if (phoneChangeOtp.trim().length !== 6) {
      setFeedback('Enter the 6-digit verification code sent to your email.', false);
      return;
    }
    setSaving(true);
    try {
      const res = await authApi.changePhone({
        currentPassword: phoneCurrentPassword,
        code: phoneChangeOtp.trim(),
        newPhone: fullPhone,
      });
      updateUser(res.user);
      setFeedback('Phone number updated successfully.', true);
      setNewPhoneLocal('');
      setPhoneCurrentPassword('');
      setPhoneChangeOtp('');
      setPhoneOtpSent(false);
    } catch (err) {
      setFeedback(getErrorMessage(err, 'Failed to update phone number.'), false);
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <AppShell
      variant="flow"
      title="Account Center"
      navItems={nav}
      stepLabel="Settings"
      backTo={getAppBackFallback(isLawyer)}
    >
      <div className="acct-settings-page">
        
        <div className="settings-profile-hero">
          <div className="settings-profile-hero__cover" aria-hidden />
          <div className="settings-profile-hero__body">
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div className="settings-profile-hero__avatar-ring">
                <UserAvatar avatarUrl={user.avatarUrl} name={user.name} size="lg" />
              </div>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarBusy}
                className="settings-profile-hero__edit"
                title="Change photo"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>photo_camera</span>
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={(e) => {
                  void handleAvatar(e.target.files?.[0] || null);
                  e.target.value = '';
                }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h2 className="settings-profile-hero__name">{user.name}</h2>
                {isLawyer && user.isVerified ? (
                  <span className="material-symbols-outlined" style={{ color: '#059669', fontSize: 22 }} title="Verified">
                    verified
                  </span>
                ) : (
                  <TrustScoreBadge score={trustScoreResult} size="md" />
                )}
              </div>
              <p className="settings-profile-hero__meta">
                {isLawyer ? 'Philippine licensed attorney' : 'Citizen account'}
                {' · '}
                {user.email}
                {user.phone ? ` · +63 ${user.phone.replace(/^0/, '')}` : ''}
              </p>
              {isCitizen && trustScoreResult.score < 100 && (
                <p className="settings-profile-hero__hint">
                  Complete remaining checks to reach 100 / 100 and unlock Schedule and Lawyers.
                </p>
              )}
            </div>
          </div>
        </div>

        <div
          className="staff-tabs"
          role="tablist"
          aria-label="Settings sections"
          onKeyDown={(e) => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            e.preventDefault();
            const tabs: SettingsTab[] = isLawyer
              ? ['profile', 'verification', 'security', 'practice', 'privacy']
              : ['profile', 'verification', 'security', 'billing', 'privacy'];
            const i = tabs.indexOf(activeTab);
            const next = e.key === 'ArrowRight'
              ? tabs[(i + 1) % tabs.length]
              : tabs[(i - 1 + tabs.length) % tabs.length];
            setActiveTab(next);
            requestAnimationFrame(() => {
              document.getElementById(`settings-tab-${next}`)?.focus();
            });
          }}
        >
          {([
            { id: 'profile' as const, label: 'Profile & Identity' },
            { id: 'verification' as const, label: isLawyer ? 'Verification' : 'Identity Verification' },
            { id: 'security' as const, label: 'Security & Login' },
            isLawyer
              ? { id: 'practice' as const, label: 'Practice' }
              : { id: 'billing' as const, label: 'Consultation Invoices' },
            { id: 'privacy' as const, label: 'Privacy' },
          ]).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`settings-tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`settings-panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              className={`staff-tab${activeTab === tab.id ? ' staff-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Global Feedback Banner */}
        {msg && (
          <div
            className={msgOk ? 'callout-success' : 'callout-error'}
            role="alert"
            style={{ marginBottom: '1.5rem', borderRadius: '10px' }}
          >
            <p className={msgOk ? 'callout-success__text' : 'callout-error__text'}>{msg}</p>
          </div>
        )}

        {/* ══════════════════ TAB 1: PROFILE & IDENTITY ══════════════════ */}
        {activeTab === 'profile' && (
          <form
            id="settings-panel-profile"
            role="tabpanel"
            aria-labelledby="settings-tab-profile"
            onSubmit={handleSaveProfile}
          >
            <div style={{ display: 'grid', gap: '1.5rem' }}>
              {/* Legal Name Section */}
              <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
                <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
                  Legal Name & Identity
                </h3>
                <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: '#64748b' }}>
                  Matches Philippine official identity records and government identification.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div className="form-field">
                    <label className="ox-label" htmlFor="acc-fname">First name *</label>
                    <input
                      id="acc-fname"
                      className="ox-input"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="e.g. Juan"
                      required
                    />
                  </div>
                  <div className="form-field">
                    <label className="ox-label" htmlFor="acc-mname">Middle name</label>
                    <input
                      id="acc-mname"
                      className="ox-input"
                      type="text"
                      value={middleName}
                      onChange={(e) => setMiddleName(e.target.value)}
                      placeholder="e.g. Santos"
                    />
                  </div>
                  <div className="form-field">
                    <label className="ox-label" htmlFor="acc-lname">Last name *</label>
                    <input
                      id="acc-lname"
                      className="ox-input"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="e.g. Dela Cruz"
                      required
                    />
                  </div>
                  <div className="form-field">
                    <label className="ox-label" htmlFor="acc-suffix">Suffix</label>
                    <input
                      id="acc-suffix"
                      className="ox-input"
                      type="text"
                      value={suffix}
                      onChange={(e) => setSuffix(e.target.value)}
                      placeholder="e.g. Jr., III"
                    />
                  </div>
                </div>
              </div>

              {/* Philippine Address / Domicile */}
              <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
                <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
                  Philippine Domicile / Practice Address (PSGC)
                </h3>
                <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: '#64748b' }}>
                  Required for Katarungang Pambarangay jurisdiction and court territorial venue.
                </p>
                <PhilippineAddressSelector
                  value={addressData}
                  onChange={setAddressData}
                  labelClass="ox-label"
                  inputClass="ox-input"
                />
              </div>

              {/* Citizen Demographics */}
              {isCitizen && (
                <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
                  <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
                    Demographics & Legal Capacity
                  </h3>
                  <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: '#64748b' }}>
                    Ensures age of majority (18+) and conflict-of-interest screening.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div className="form-field">
                      <label className="ox-label" htmlFor="acc-dob">Date of birth (18+ required) *</label>
                      <input
                        id="acc-dob"
                        className="ox-input"
                        type="date"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-field">
                      <label className="ox-label" htmlFor="acc-gender">Gender</label>
                      <select
                        id="acc-gender"
                        className="ox-input"
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                      >
                        <option value="">Select gender…</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                    </div>
                    <div className="form-field">
                      <label className="ox-label" htmlFor="acc-civil">Civil status</label>
                      <select
                        id="acc-civil"
                        className="ox-input"
                        value={civilStatus}
                        onChange={(e) => setCivilStatus(e.target.value)}
                      >
                        <option value="">Select status…</option>
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Separated">Separated</option>
                        <option value="Widowed">Widowed</option>
                      </select>
                    </div>
                    <div className="form-field">
                      <label className="ox-label" htmlFor="acc-occ">Occupation</label>
                      <input
                        id="acc-occ"
                        className="ox-input"
                        type="text"
                        placeholder="e.g. Teacher, Engineer, Freelancer"
                        value={occupation}
                        onChange={(e) => setOccupation(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Lawyer Practice Bio & Areas */}
              {isLawyer && (
                <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
                  <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
                    Practice Areas & Background
                  </h3>
                  <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: '#64748b' }}>
                    Displayed on your verified counsel profile on the public lawyer directory.
                  </p>
                  <div className="form-field" style={{ marginBottom: '1rem' }}>
                    <label className="ox-label">Practice Areas / Specializations</label>
                    <LawyerSpecializationsEditor
                      value={specializations}
                      onChange={setSpecializations}
                      disabled={saving}
                    />
                  </div>
                  <div className="form-field" style={{ marginBottom: '1rem' }}>
                    <label className="ox-label" htmlFor="acc-lawfirm">Law Firm / Chamber</label>
                    <input
                      id="acc-lawfirm"
                      className="ox-input"
                      type="text"
                      placeholder="e.g. Mitchell & Associates Law Office"
                      value={lawFirmName}
                      onChange={(e) => setLawFirmName(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label className="ox-label" htmlFor="acc-bio">Professional Biography</label>
                    <textarea
                      id="acc-bio"
                      className="ox-textarea"
                      rows={4}
                      placeholder="Describe your legal background, trial experience, and consultation focus."
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                {((firstName.trim() || '') !== (user?.firstName || '')
                  || (middleName.trim() || '') !== (user?.middleName || '')
                  || (lastName.trim() || '') !== (user?.lastName || '')
                  || (isCitizen && (
                    (dob || '') !== (user?.dob || '')
                    || (citizenIdNumber.trim() || '') !== (user?.citizenIdNumber || '')
                  ))) && (
                  <div className="form-field" style={{ minWidth: 220, flex: 1 }}>
                    <label className="ox-label" htmlFor="acc-profile-password">Current password to change legal name</label>
                    <input
                      id="acc-profile-password"
                      className="ox-input"
                      type="password"
                      autoComplete="current-password"
                      value={profileConfirmPassword}
                      onChange={(e) => setProfileConfirmPassword(e.target.value)}
                    />
                  </div>
                )}
                <button
                  type="submit"
                  className="ox-btn ox-btn-primary"
                  disabled={saving}
                  style={{ minWidth: '180px', fontWeight: 600 }}
                >
                  {saving ? 'Saving changes…' : 'Save Profile Details'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ══════════════════ TAB 2: VERIFICATION & BAR STANDING ══════════════════ */}
        {activeTab === 'verification' && (
          <div id="settings-panel-verification" role="tabpanel" aria-labelledby="settings-tab-verification">
            {isCitizen ? (
              <CitizenVerificationPanel onSuccess={() => void refreshUser()} />
            ) : (
              <div className="staff-page-grid staff-page-grid--2 settings-verification-grid">
                <section className="settings-group">
                  <div className="settings-group__intro">
                    <h3 className="settings-group__label">Bar standing</h3>
                    <p className="settings-group__desc">
                      Roll, IBP, PTR, and MCLE details used on your counsel profile.{' '}
                      <a href="https://elibrary.judiciary.gov.ph/" target="_blank" rel="noopener noreferrer" className="list-panel__link">
                        Supreme Court e-Library
                      </a>
                    </p>
                  </div>
                  <div className="settings-group__card settings-group__card--pad">
                    <form onSubmit={handleSaveProfile}>
                      <div className="settings-bar-grid">
                        <div className="form-field">
                          <label className="ox-label" htmlFor="acc-roll">Roll of Attorneys number</label>
                          <input
                            id="acc-roll"
                            className="ox-input"
                            type="text"
                            placeholder="e.g. 54321"
                            value={barNumber}
                            onChange={(e) => setBarNumber(e.target.value)}
                            required
                          />
                        </div>
                        <div className="form-field">
                          <label className="ox-label" htmlFor="acc-admit">Bar admission year</label>
                          <input
                            id="acc-admit"
                            className="ox-input"
                            type="number"
                            placeholder="e.g. 2014"
                            value={barAdmissionYear}
                            onChange={(e) => setBarAdmissionYear(e.target.value ? parseInt(e.target.value, 10) : '')}
                          />
                        </div>
                        <div className="form-field">
                          <label className="ox-label" htmlFor="acc-ibp-chap">IBP chapter</label>
                          <input
                            id="acc-ibp-chap"
                            className="ox-input"
                            type="text"
                            placeholder="e.g. Davao del Sur"
                            value={ibpChapter}
                            onChange={(e) => setIbpChapter(e.target.value)}
                            required
                          />
                        </div>
                        <div className="form-field">
                          <label className="ox-label" htmlFor="acc-ibp-id">IBP ID number</label>
                          <input
                            id="acc-ibp-id"
                            className="ox-input"
                            type="text"
                            placeholder="e.g. IBP-DVO-2014-9988"
                            value={ibpIdNumber}
                            onChange={(e) => setIbpIdNumber(e.target.value)}
                            required
                          />
                        </div>
                        <div className="form-field">
                          <label className="ox-label" htmlFor="acc-ptr">PTR number</label>
                          <input
                            id="acc-ptr"
                            className="ox-input"
                            type="text"
                            placeholder="e.g. PTR-2026-891012"
                            value={ptrNumber}
                            onChange={(e) => setPtrNumber(e.target.value)}
                            required
                          />
                        </div>
                        <div className="form-field">
                          <label className="ox-label" htmlFor="acc-ptr-lgu">PTR issuing city</label>
                          <input
                            id="acc-ptr-lgu"
                            className="ox-input"
                            type="text"
                            placeholder="e.g. Davao City"
                            value={ptrLgu}
                            onChange={(e) => setPtrLgu(e.target.value)}
                            required
                          />
                        </div>
                        <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                          <label className="ox-label" htmlFor="acc-mcle">MCLE compliance number</label>
                          <input
                            id="acc-mcle"
                            className="ox-input"
                            type="text"
                            placeholder="e.g. MCLE Compliance No. VIII-001249"
                            value={mcleComplianceNo}
                            onChange={(e) => setMcleComplianceNo(e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <details className="settings-pleading-preview">
                        <summary>Pleading signature preview</summary>
                        <div className="settings-pleading-preview__body">
                          <div>{user.name || 'Atty. Legal Counsel'}</div>
                          <div>Roll of Attorneys No. {barNumber || 'XXXXX'}</div>
                          <div>IBP No. {ibpIdNumber || 'XXXXXX'}; {ibpChapter || 'Chapter Name'}</div>
                          <div>PTR No. {ptrNumber || 'XXXXXXX'}; {ptrLgu || 'City'}</div>
                          <div>{mcleComplianceNo || 'MCLE Compliance No. VIII-XXXXXXX'}</div>
                        </div>
                      </details>

                      <div style={{ marginTop: '1.1rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="submit" className="ox-btn ox-btn-primary" disabled={saving}>
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </form>
                  </div>
                </section>

                <section className="settings-group">
                  <div className="settings-group__intro">
                    <h3 className="settings-group__label">ID and selfie</h3>
                    <p className="settings-group__desc">
                      Match your government ID and selfie to the Supreme Court roll to appear in the lawyer directory.
                      Complete each section in order. Later sections stay visible but stay locked until the previous check succeeds.
                    </p>
                  </div>
                  <div className="settings-group__card settings-group__card--pad">
                    <LawyerVerificationWizard
                      user={user}
                      onUpdated={(u) => { updateUser(u); void refreshUser(); }}
                      onVerified={() => navigate('/lawyer/dashboard', { replace: true })}
                    />
                  </div>
                </section>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════ TAB 3: SECURITY & PASSWORD ══════════════════ */}
        {activeTab === 'security' && (
          <div
            id="settings-panel-security"
            role="tabpanel"
            aria-labelledby="settings-tab-security"
            style={{ display: 'grid', gap: '1.5rem' }}
          >
            <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
                Sign-in Credentials
              </h3>
              <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: '#64748b' }}>
                Manage your registered contact email and Philippine mobile phone.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div className="settings-info-row" style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '8px' }}>
                  <span className="settings-info-row__label">Registered Email</span>
                  <strong style={{ color: '#0f172a' }}>{user.email}</strong>
                </div>
                <div className="settings-info-row" style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '8px' }}>
                  <span className="settings-info-row__label">Mobile Phone</span>
                  <strong style={{ color: '#0f172a' }}>+63 {user.phone?.replace(/^0/, '')}</strong>
                </div>
              </div>
            </div>

            <form onSubmit={handlePasswordChange}>
              <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
                <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
                  Change password
                </h3>
                <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: '#64748b' }}>
                  We email a code to {user.email}, then ask your security question. Current password is not required.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                  <div className="form-field">
                    <label className="ox-label" htmlFor="acc-newpass">New password (8+ characters)</label>
                    <input
                      id="acc-newpass"
                      className="ox-input"
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label className="ox-label" htmlFor="acc-confirmpass">Confirm new password</label>
                    <input
                      id="acc-confirmpass"
                      className="ox-input"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>

                {user.securityQuestion && (
                  <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                      <div className="form-field">
                        <label className="ox-label">Security question</label>
                        <p className="ox-input" style={{ margin: 0, background: '#f8fafc' }}>{user.securityQuestion}</p>
                      </div>
                      <div className="form-field">
                        <label className="ox-label" htmlFor="acc-sec-a">Your answer</label>
                        <input
                          id="acc-sec-a"
                          className="ox-input"
                          type="text"
                          value={securityAnswer}
                          onChange={(e) => setSecurityAnswer(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {passwordOtpSent && (
                  <div style={{ marginTop: '1.25rem' }}>
                    <label className="ox-label">Email verification code</label>
                    <OtpCodeInput value={changeOtpCode} onChange={setChangeOtpCode} disabled={saving} />
                  </div>
                )}

                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="submit" className="ox-btn ox-btn-primary" disabled={saving}>
                    {saving
                      ? 'Processing…'
                      : passwordOtpSent
                        ? 'Update password'
                        : 'Send verification code'}
                  </button>
                </div>
              </div>
            </form>

            <form onSubmit={handleEmailChange}>
              <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
                <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
                  Change email
                </h3>
                <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: '#64748b' }}>
                  Confirm with your current password. We send a 6-digit code to the new email to prove you own that inbox.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                  <div className="form-field">
                    <label className="ox-label" htmlFor="acc-email-currentpass">Current password</label>
                    <input
                      id="acc-email-currentpass"
                      className="ox-input"
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label className="ox-label" htmlFor="acc-newemail">New email address</label>
                    <input
                      id="acc-newemail"
                      className="ox-input"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                    />
                  </div>
                </div>
                {emailOtpSent && (
                  <div style={{ marginTop: '1.25rem' }}>
                    <label className="ox-label">Code sent to the new email</label>
                    <OtpCodeInput value={emailChangeOtp} onChange={setEmailChangeOtp} disabled={saving} />
                  </div>
                )}
                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="ox-btn ox-btn-secondary" disabled={saving}>
                    {saving ? 'Processing…' : emailOtpSent ? 'Confirm email change' : 'Send code to new email'}
                  </button>
                </div>
              </div>
            </form>

            <form onSubmit={handlePhoneChange}>
              <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
                <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
                  Change phone
                </h3>
                <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: '#64748b' }}>
                  Confirm with your current password. We send a 6-digit code to your email.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                  <div className="form-field">
                    <label className="ox-label" htmlFor="acc-phone-currentpass">Current password</label>
                    <input
                      id="acc-phone-currentpass"
                      className="ox-input"
                      type="password"
                      autoComplete="current-password"
                      value={phoneCurrentPassword}
                      onChange={(e) => setPhoneCurrentPassword(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label className="ox-label" htmlFor="acc-newphone">New mobile number</label>
                    <PhoneInput
                      id="acc-newphone"
                      value={newPhoneLocal}
                      onChange={setNewPhoneLocal}
                      inputClassName="ox-input"
                    />
                  </div>
                </div>
                {phoneOtpSent && (
                  <div style={{ marginTop: '1.25rem' }}>
                    <label className="ox-label">Code sent to your email</label>
                    <OtpCodeInput value={phoneChangeOtp} onChange={setPhoneChangeOtp} disabled={saving} />
                  </div>
                )}
                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="ox-btn ox-btn-secondary" disabled={saving}>
                    {saving ? 'Processing…' : phoneOtpSent ? 'Update phone' : 'Send code to email'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* ══════════════════ TAB 4: PRACTICE & SCHEDULE (LAWYER) ══════════════════ */}
        {activeTab === 'practice' && isLawyer && (
          <div
            id="settings-panel-practice"
            role="tabpanel"
            aria-labelledby="settings-tab-practice"
            style={{ display: 'grid', gap: '1.5rem' }}
          >
            <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
                Availability Schedule & Working Hours
              </h3>
              <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: '#64748b' }}>
                Set your weekly consulting calendar and session buffers.
              </p>
              <LawyerBookingSettings onFeedback={setFeedback} />
            </div>

            <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
                Consultation Earnings & Payout Methods
              </h3>
              <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: '#64748b' }}>
                Request payouts of completed session earnings to the e-wallet or bank account saved above.
              </p>
              <LawyerEarningsTab onFeedback={setFeedback} />
            </div>
          </div>
        )}

        {/* ══════════════════ TAB 4: BILLING & INVOICES (CITIZEN) ══════════════════ */}
        {activeTab === 'billing' && isCitizen && (
          <div
            id="settings-panel-billing"
            role="tabpanel"
            aria-labelledby="settings-tab-billing"
            style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '1.5rem' }}
          >
            <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
              Consultation Payments & Invoices
            </h3>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: '#64748b' }}>
              Ordinex charges per scheduled consultation session. No hidden monthly subscriptions.
            </p>
            <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
              <strong style={{ color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                Consultation Payment Model
              </strong>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569' }}>
                Each lawyer sets their consultation fee (e.g. ₱500 - ₱1,500). PAO and Public Lawyers provide assistance free of charge (₱0).
              </p>
              <Link to="/directory" style={{ display: 'inline-block', marginTop: '1rem' }}>
                <button type="button" className="ox-btn ox-btn-primary ox-btn-sm">
                  Browse Verified Lawyers
                </button>
              </Link>
            </div>

            <PaymentDestinationForm
              onFeedback={setFeedback}
              heading="Your e-wallet or bank"
              description="Checkout uses only what you save here: e-wallet (GCash or Maya) and/or bank. PayMongo will offer those same options when you pay a booking. Refunds return to the method you paid with."
              idPrefix="citizen-billing"
              saveLabel="Save payment details"
            />
          </div>
        )}

        {/* ══════════════════ TAB 5: PRIVACY & COMPLIANCE ══════════════════ */}
        {activeTab === 'privacy' && (
          <div
            id="settings-panel-privacy"
            role="tabpanel"
            aria-labelledby="settings-tab-privacy"
            style={{ display: 'grid', gap: '1.5rem' }}
          >
            <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
                Republic Act No. 10173 (Data Privacy Act of 2012)
              </h3>
              <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: '#64748b' }}>
                Your rights as a data subject under Philippine privacy legislation.
              </p>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <Link to="/privacy" className="ox-btn ox-btn-secondary ox-btn-sm">
                  View Privacy Policy →
                </Link>
                <Link to="/terms" className="ox-btn ox-btn-secondary ox-btn-sm">
                  View Terms of Service →
                </Link>
                <Link to="/licenses" className="ox-btn ox-btn-secondary ox-btn-sm">
                  Open Source Licenses →
                </Link>
              </div>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
              <RecycleBinPanel isLawyer={isLawyer} onBack={() => {}} />
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
};

export default AccountSettings;
