import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/shell/AppShell';
import { useAuth } from '../context/AuthContext';
import { authApi, profileApi } from '../services/api';
import { getErrorMessage } from '../utils/userFacingError';
import { UserAvatar } from '../components/UserAvatar';
import { getCitizenNav } from '../utils/citizenWorkspace';
import { getLawyerNav } from '../utils/lawyerWorkspace';
import { getAppBackFallback } from '../utils/navigation';
import { computeUserCompleteness } from '../utils/profileCompleteness';
import { computeCitizenTrustScore, computeLawyerTrustScore } from '../utils/trustScore';
import { ProfileStrengthCard } from '../components/profile/ProfileStrengthCard';
import { LinkedInProfileHeader } from '../components/profile/LinkedInProfileHeader';
import { PhilippineAddressSelector, type PhilippineAddressData } from '../components/ui/PhilippineAddressSelector';
import { LawyerVerificationWizard } from '../components/settings/LawyerVerificationWizard';
import { LawyerCredentialsPanel } from '../components/settings/LawyerCredentialsPanel';
import { LawyerSpecializationsEditor } from '../components/settings/LawyerSpecializationsEditor';
import { LawyerPracticeBadge } from '../components/lawyer/LawyerPracticeBadge';

export const ProfileCompletionPage: React.FC = () => {
  const { user, refreshUser, updateUser } = useAuth();
  const navigate = useNavigate();
  const avatarRef = useRef<HTMLInputElement>(null);

  const isCitizen = user?.role === 'CITIZEN';
  const isLawyer = user?.role === 'LAWYER';
  const nav = isCitizen ? getCitizenNav(user) : getLawyerNav(user);

  const [name, setName] = useState(user?.name || '');
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [middleName, setMiddleName] = useState(user?.middleName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [suffix, setSuffix] = useState(user?.suffix || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [specializations, setSpecializations] = useState<string[]>(user?.specializations ?? []);
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgOk, setMsgOk] = useState(false);

  // Citizen demographics & legal capacity
  const [dob, setDob] = useState(user?.dob || '');
  const [gender, setGender] = useState(user?.gender || '');
  const [citizenship, setCitizenship] = useState(user?.citizenship || 'Filipino');
  const [civilStatus, setCivilStatus] = useState(user?.civilStatus || '');
  const [occupation, setOccupation] = useState(user?.occupation || '');
  const [indigencyTier, setIndigencyTier] = useState(user?.indigencyTier || 'STANDARD');

  // Structured PSGC Address
  const [addressData, setAddressData] = useState<Partial<PhilippineAddressData>>({
    region: user?.region || '',
    province: user?.province || '',
    city: user?.city || '',
    barangay: user?.barangay || '',
    streetAddress: user?.streetAddress || '',
    zipCode: user?.zipCode || '',
    formattedAddress: user?.address || '',
  });

  // ID & Emergency contact
  const [citizenIdType, setCitizenIdType] = useState(user?.citizenIdType || 'PHILID');
  const [citizenIdNumber, setCitizenIdNumber] = useState(user?.citizenIdNumber || '');
  const [emergencyContactName, setEmergencyContactName] = useState(user?.emergencyContactName || '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(user?.emergencyContactPhone || '');
  const [emergencyRelationship, setEmergencyRelationship] = useState(user?.emergencyRelationship || '');

  useEffect(() => {
    setName(user?.name || '');
    setFirstName(user?.firstName || '');
    setMiddleName(user?.middleName || '');
    setLastName(user?.lastName || '');
    setSuffix(user?.suffix || '');
    setBio(user?.bio || '');
    setSpecializations(user?.specializations ?? []);
    setDob(user?.dob || '');
    setGender(user?.gender || '');
    setCitizenship(user?.citizenship || 'Filipino');
    setCivilStatus(user?.civilStatus || '');
    setOccupation(user?.occupation || '');
    setIndigencyTier(user?.indigencyTier || 'STANDARD');
    setAddressData({
      region: user?.region || '',
      province: user?.province || '',
      city: user?.city || '',
      barangay: user?.barangay || '',
      streetAddress: user?.streetAddress || '',
      zipCode: user?.zipCode || '',
      formattedAddress: user?.address || '',
    });
    setCitizenIdType(user?.citizenIdType || 'PHILID');
    setCitizenIdNumber(user?.citizenIdNumber || '');
    setEmergencyContactName(user?.emergencyContactName || '');
    setEmergencyContactPhone(user?.emergencyContactPhone || '');
    setEmergencyRelationship(user?.emergencyRelationship || '');
  }, [user]);

  const trustScoreResult = useMemo(() => {
    if (!user) return { score: 0, maxScore: 100, level: 'UNVERIFIED', badgeLabel: '0 ID PROOF', badgeColor: '#94a3b8', checks: [] };
    if (isLawyer) {
      return computeLawyerTrustScore({
        email: user.email,
        phone: user.phone,
        isVerified: user.isVerified,
        barNumber: user.barNumber,
        ibpChapter: user.ibpChapter,
        lawyerVerificationStatus: user.lawyerVerificationStatus,
        avatarUrl: user.avatarUrl,
        credentials: user.credentials,
        specializations: user.specializations,
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
  }, [user, isLawyer, name, addressData.formattedAddress, dob, civilStatus, citizenIdNumber, emergencyContactName]);

  const completeness = useMemo(
    () => (user ? computeUserCompleteness({
      ...user,
      name: name.trim() || user.name,
      bio: bio.trim() || user.bio,
    }) : { score: 0, checks: [] }),
    [user, name, bio],
  );

  const setFeedback = (text: string, ok: boolean) => {
    setMsg(text);
    setMsgOk(ok);
    if (ok) setTimeout(() => setMsg(''), 4000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const computedName = [firstName.trim(), middleName.trim(), lastName.trim(), suffix.trim()].filter(Boolean).join(' ') || name.trim();

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
      if (isLawyer) {
        updates.specializations = specializations;
      }
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
      await authApi.updateProfile(updates as any);
      await refreshUser();
      setFeedback('Profile and verification details saved successfully.', true);
    } catch (err) {
      setFeedback(getErrorMessage(err, 'Update failed. Please try again.'), false);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatar = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFeedback('Please choose a JPEG or PNG image.', false);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFeedback('Image must be under 5 MB.', false);
      return;
    }
    setAvatarBusy(true);
    setMsg('');
    try {
      const res = await profileApi.uploadAvatar(file);
      updateUser({ avatarUrl: res.avatarUrl });
      setFeedback('Profile photo updated.', true);
    } catch (err) {
      setFeedback(getErrorMessage(err, 'Upload failed. Please try again.'), false);
    } finally {
      setAvatarBusy(false);
    }
  };

  if (!user) return null;

  return (
    <AppShell
      variant="flow"
      title="Profile & Verification"
      navItems={nav}
      stepLabel="Identity"
      backTo={getAppBackFallback(isLawyer)}
    >
      <div className="dash-layout dash-layout--settings" style={{ maxWidth: '880px', margin: '0 auto' }}>
        {/* Profile Card */}
        <LinkedInProfileHeader
          name={name.trim() || user.name}
          role={user.role}
          avatarUrl={user.avatarUrl}
          isVerified={user.isVerified}
          trustScore={trustScoreResult.score}
          headline={bio || (isLawyer ? (user.specializations?.join(' · ') || 'General Legal Practice') : 'Verified Legal Seeker')}
          location={addressData.formattedAddress || (isLawyer ? user.ibpChapter : undefined)}
          practiceType={user.practiceType}
          barNumber={user.barNumber}
          onEditProfile={() => {}}
          onUploadAvatar={() => avatarRef.current?.click()}
          onVerifyNow={() => {}}
          isOwnProfile
        />

        <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
          <ProfileStrengthCard
            completeness={completeness}
            className="settings-profile-strength"
            collapsibleChecklist={false}
          />
        </div>

        {msg && (
          <div className={msgOk ? 'callout-success' : 'callout-error'} role="alert" style={{ marginBottom: '1.5rem' }}>
            <p className={msgOk ? 'callout-success__text' : 'callout-error__text'}>{msg}</p>
          </div>
        )}

        <form className="settings-editor" onSubmit={handleSave}>
          {/* Photo Section */}
          <section className="settings-group">
            <div className="settings-group__intro">
              <h3 className="settings-group__label">Profile Photo</h3>
              <p className="settings-group__desc">A clear headshot helps build trust with lawyers and clients.</p>
            </div>
            <div className="settings-group__card settings-group__card--pad">
              <div className="settings-avatar">
                <button
                  type="button"
                  className="settings-avatar__ring"
                  onClick={() => avatarRef.current?.click()}
                  title="Change profile photo"
                >
                  <UserAvatar avatarUrl={user.avatarUrl} name={user.name} size="lg" />
                </button>
                <input
                  ref={avatarRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="settings-avatar__input"
                  onChange={(e) => {
                    void handleAvatar(e.target.files?.[0] || null);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  className="ox-btn ox-btn-secondary ox-btn-sm"
                  disabled={avatarBusy}
                  onClick={() => avatarRef.current?.click()}
                >
                  {avatarBusy ? 'Uploading…' : 'Upload photo'}
                </button>
              </div>
            </div>
          </section>

          {/* Legal Name & Identity */}
          <section className="settings-group">
            <div className="settings-group__intro">
              <h3 className="settings-group__label">Legal Name & Identity</h3>
              <p className="settings-group__desc">Matches official Philippine government records.</p>
            </div>
            <div className="settings-group__card settings-group__card--pad">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                <div className="form-field">
                  <label className="ox-label" htmlFor="profile-fname">First name *</label>
                  <input
                    id="profile-fname"
                    className="ox-input"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    required
                  />
                </div>
                <div className="form-field">
                  <label className="ox-label" htmlFor="profile-mname">Middle name</label>
                  <input
                    id="profile-mname"
                    className="ox-input"
                    type="text"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    placeholder="Middle name"
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginTop: '0.5rem' }}>
                <div className="form-field">
                  <label className="ox-label" htmlFor="profile-lname">Last name *</label>
                  <input
                    id="profile-lname"
                    className="ox-input"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                    required
                  />
                </div>
                <div className="form-field">
                  <label className="ox-label" htmlFor="profile-suffix">Suffix</label>
                  <input
                    id="profile-suffix"
                    className="ox-input"
                    type="text"
                    value={suffix}
                    onChange={(e) => setSuffix(e.target.value)}
                    placeholder="e.g. Jr., III"
                  />
                </div>
              </div>
              <div className="form-field" style={{ marginTop: '0.5rem' }}>
                <label className="ox-label" htmlFor="profile-bio">About / Background</label>
                <textarea
                  id="profile-bio"
                  className="ox-textarea"
                  rows={3}
                  placeholder={
                    isLawyer
                      ? 'Describe your practice areas, experience, and consultation focus.'
                      : 'Brief background to help your lawyer understand your legal situation.'
                  }
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Domicile / PSGC Address */}
          <section className="settings-group">
            <div className="settings-group__intro">
              <h3 className="settings-group__label">Philippine Domicile (PSGC)</h3>
              <p className="settings-group__desc">
                Establishes court jurisdiction and local legal venue for Barangay Conciliation (Katarungang Pambarangay).
              </p>
            </div>
            <div className="settings-group__card settings-group__card--pad">
              <PhilippineAddressSelector
                value={addressData}
                onChange={setAddressData}
                labelClass="ox-label"
                inputClass="ox-input"
              />
            </div>
          </section>

          {/* Citizen Legal Capacity & Demographics */}
          {isCitizen && (
            <section className="settings-group">
              <div className="settings-group__intro">
                <h3 className="settings-group__label">Legal Capacity & Demographics</h3>
                <p className="settings-group__desc">
                  Required to verify adulthood (18+) and conflict-of-interest checks before consultation booking.
                </p>
              </div>
              <div className="settings-group__card settings-group__card--pad">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  <div className="form-field">
                    <label className="ox-label" htmlFor="profile-dob">Date of birth (18+ required) *</label>
                    <input
                      id="profile-dob"
                      className="ox-input"
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-field">
                    <label className="ox-label" htmlFor="profile-gender">Gender</label>
                    <select
                      id="profile-gender"
                      className="ox-input"
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                    >
                      <option value="">Select…</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <div className="form-field">
                    <label className="ox-label" htmlFor="profile-civil-status">Civil status</label>
                    <select
                      id="profile-civil-status"
                      className="ox-input"
                      value={civilStatus}
                      onChange={(e) => setCivilStatus(e.target.value)}
                    >
                      <option value="">Select…</option>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Separated">Separated</option>
                      <option value="Widowed">Widowed</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label className="ox-label" htmlFor="profile-occupation">Occupation</label>
                    <input
                      id="profile-occupation"
                      className="ox-input"
                      type="text"
                      placeholder="e.g. Teacher, OFW, Freelancer"
                      value={occupation}
                      onChange={(e) => setOccupation(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <div className="form-field">
                    <label className="ox-label" htmlFor="profile-idtype">Government ID Type *</label>
                    <select
                      id="profile-idtype"
                      className="ox-input"
                      value={citizenIdType}
                      onChange={(e) => setCitizenIdType(e.target.value)}
                    >
                      <option value="PHILID">PhilID (National ID)</option>
                      <option value="PASSPORT">Philippine Passport</option>
                      <option value="DRIVERS_LICENSE">LTO Driver's License</option>
                      <option value="UMID">UMID Card</option>
                      <option value="POSTAL">Postal ID</option>
                      <option value="PRC">PRC ID</option>
                      <option value="VOTER">Voter's ID / Certificate</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label className="ox-label" htmlFor="profile-idnum">Government ID Number *</label>
                    <input
                      id="profile-idnum"
                      className="ox-input"
                      type="text"
                      placeholder="e.g. 1234-5678-9012-3456"
                      value={citizenIdNumber}
                      onChange={(e) => setCitizenIdNumber(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                    Emergency Contact / Next-of-Kin
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                    <div className="form-field">
                      <label className="ox-label">Contact Name</label>
                      <input
                        className="ox-input"
                        type="text"
                        placeholder="Full name"
                        value={emergencyContactName}
                        onChange={(e) => setEmergencyContactName(e.target.value)}
                      />
                    </div>
                    <div className="form-field">
                      <label className="ox-label">Relationship</label>
                      <input
                        className="ox-input"
                        type="text"
                        placeholder="e.g. Spouse, Parent, Sibling"
                        value={emergencyRelationship}
                        onChange={(e) => setEmergencyRelationship(e.target.value)}
                      />
                    </div>
                    <div className="form-field">
                      <label className="ox-label">Contact Mobile</label>
                      <input
                        className="ox-input"
                        type="tel"
                        placeholder="09XX XXX XXXX"
                        value={emergencyContactPhone}
                        onChange={(e) => setEmergencyContactPhone(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Lawyer Practice & Verification */}
          {isLawyer && (
            <>
              <section className="settings-group">
                <div className="settings-group__intro">
                  <h3 className="settings-group__label">Practice & Specializations</h3>
                  <p className="settings-group__desc">Shown on your public counsel listing after verification.</p>
                </div>
                <div className="settings-group__card settings-group__card--pad">
                  <div className="settings-practice-summary" style={{ marginBottom: 12 }}>
                    <LawyerPracticeBadge practiceType={user.practiceType} />
                    {user.barNumber && (
                      <p className="profile-email" style={{ marginTop: 8 }}>IBP / Roll: {user.barNumber}</p>
                    )}
                  </div>
                  <LawyerSpecializationsEditor
                    value={specializations}
                    onChange={setSpecializations}
                    disabled={saving}
                  />
                </div>
              </section>

              <section className="settings-group">
                <div className="settings-group__intro">
                  <h3 className="settings-group__label">Supreme Court & Identity Verification</h3>
                  <p className="settings-group__desc">Cross-reference with the SC Roll and document verification.</p>
                </div>
                <div className="settings-group__card settings-group__card--pad">
                  <LawyerVerificationWizard
                    user={user}
                    onUpdated={(u) => { updateUser(u); void refreshUser(); }}
                  />
                  <h4 className="settings-group__label" style={{ marginTop: 24 }}>Supporting credentials</h4>
                  <p className="settings-group__desc">Optional documents that support your practice listing.</p>
                  <LawyerCredentialsPanel user={user} onUpdated={(u) => { updateUser(u); void refreshUser(); }} />
                </div>
              </section>
            </>
          )}

          <div className="settings-actions form-actions-bar" style={{ marginTop: '2rem' }}>
            <button
              type="button"
              className="ox-btn ox-btn-ghost"
              onClick={() => navigate('/settings')}
            >
              Go to Account Settings
            </button>
            <button className="ox-btn ox-btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving changes…' : 'Save & Update Profile'}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
};

export default ProfileCompletionPage;
