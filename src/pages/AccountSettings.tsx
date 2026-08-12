import React, { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/shell/AppShell';
import { useAuth } from '../context/AuthContext';
import { authApi, profileApi } from '../services/api';
import { getErrorMessage } from '../utils/userFacingError';
import { UserAvatar } from '../components/UserAvatar';
import { getCitizenNav } from '../utils/citizenWorkspace';
import { lawyerNav } from '../utils/lawyerWorkspace';
import { getAppBackFallback } from '../utils/navigation';
import { computeUserCompleteness } from '../utils/profileCompleteness';
import { ProfileStrengthCard } from '../components/profile/ProfileStrengthCard';
import { CitizenTrustPanel } from '../components/profile/CitizenTrustPanel';
import { DashSettingsIntro } from '../components/settings/DashSettingsIntro';
import { LawyerProfilePreview } from '../components/settings/LawyerProfilePreview';
import { LawyerBookingSettings } from '../components/settings/LawyerBookingSettings';
import { SettingsHub, type SettingsSection } from '../components/settings/SettingsHub';
import { LawyerCredentialsPanel } from '../components/settings/LawyerCredentialsPanel';
import { LawyerVerificationWizard } from '../components/settings/LawyerVerificationWizard';
import { RecycleBinPanel } from '../components/settings/RecycleBinPanel';
import { LawyerSpecializationsEditor } from '../components/settings/LawyerSpecializationsEditor';
import { LawyerEarningsTab } from '../components/settings/LawyerEarningsTab';
import { LawyerPracticeBadge } from '../components/lawyer/LawyerPracticeBadge';

type SettingsView = 'hub' | SettingsSection;

function SectionBack({ onBack, title }: { readonly onBack: () => void; readonly title: string }) {
  return (
    <button type="button" className="settings-section-back" onClick={onBack}>
      <span aria-hidden>‹</span>
      {title}
    </button>
  );
}

export const AccountSettings: React.FC = () => {
  const { user, logout, refreshUser, updateUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [specializations, setSpecializations] = useState<string[]>(user?.specializations ?? []);
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgOk, setMsgOk] = useState(false);
  const [showProfilePreview, setShowProfilePreview] = useState(false);
  const [lawyerTab, setLawyerTab] = useState<'general' | 'booking' | 'earnings'>('general');
  const [view, setView] = useState<SettingsView>('hub');
  const avatarRef = useRef<HTMLInputElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  // Citizen expanded-profile fields
  const [dob, setDob] = useState(user?.dob || '');
  const [gender, setGender] = useState(user?.gender || '');
  const [address, setAddress] = useState(user?.address || '');
  const [civilStatus, setCivilStatus] = useState(user?.civilStatus || '');
  const [occupation, setOccupation] = useState(user?.occupation || '');
  const navigate = useNavigate();

  const isCitizen = user?.role === 'CITIZEN';
  const isLawyer = user?.role === 'LAWYER';
  const nav = isCitizen ? getCitizenNav() : lawyerNav;

  const completeness = useMemo(
    () => (user ? computeUserCompleteness({
      ...user,
      name: name.trim() || user.name,
      bio: bio.trim() || user.bio,
    }) : { score: 0, checks: [] }),
    [user, name, bio],
  );

  React.useEffect(() => {
    setName(user?.name || '');
    setBio(user?.bio || '');
    setSpecializations(user?.specializations ?? []);
    setDob(user?.dob || '');
    setGender(user?.gender || '');
    setAddress(user?.address || '');
    setCivilStatus(user?.civilStatus || '');
    setOccupation(user?.occupation || '');
  }, [user?.name, user?.bio, user?.specializations, user?.dob, user?.gender, user?.address, user?.civilStatus, user?.occupation]);

  const setFeedback = (text: string, ok: boolean) => {
    setMsg(text);
    setMsgOk(ok);
    if (ok) setTimeout(() => setMsg(''), 4000);
  };

  React.useEffect(() => {
    if (searchParams.get('onboard') !== 'lawyer' || !isLawyer) return;
    const next = new URLSearchParams(searchParams);
    next.delete('onboard');
    setSearchParams(next, { replace: true });
    navigate('/lawyer/register?phase=kyc', { replace: true });
  }, [searchParams, setSearchParams, isLawyer, navigate]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const updates: Record<string, unknown> = {
        name: name.trim(),
        bio: bio.trim() || undefined,
      };
      if (isLawyer) {
        updates.specializations = specializations;
      }
      if (isCitizen) {
        updates.dob = dob || undefined;
        updates.gender = gender || undefined;
        updates.address = address.trim() || undefined;
        updates.civilStatus = civilStatus || undefined;
        updates.occupation = occupation.trim() || undefined;
      }
      await authApi.updateProfile(updates as any);
      await refreshUser();
      setFeedback('Profile updated successfully.', true);
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

  const phoneDisplay = user.phone?.replace(/^0/, '') || '';
  const goHub = () => setView('hub');

  const profileForm = (
    <div className="settings-ac settings-ac--drill">
      <SectionBack onBack={goHub} title="Profile" />
      <form className="settings-editor settings-editor--ac" onSubmit={handleSave}>
      {!showProfilePreview && (
        <ProfileStrengthCard
          completeness={completeness}
          className="settings-profile-strength"
          collapsibleChecklist
        />
      )}

      <section className="settings-group">
        <div className="settings-group__intro">
          <h3 className="settings-group__label">Photo</h3>
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
            className="staff-ribbon__signout"
            disabled={avatarBusy}
            onClick={() => avatarRef.current?.click()}
          >
            {avatarBusy ? 'Uploading…' : 'Upload photo'}
          </button>
        </div>
        </div>
      </section>

      <section className="settings-group">
        <div className="settings-group__intro">
          <h3 className="settings-group__label">About</h3>
        </div>
        <div className="settings-group__card settings-group__card--pad">
        <div className="form-field">
          <label className="ox-label" htmlFor="settings-name">Display name</label>
          <input
            id="settings-name"
            className="ox-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label className="ox-label" htmlFor="settings-bio">Bio</label>
          <textarea
            id="settings-bio"
            className="ox-textarea"
            rows={4}
            placeholder={
              isLawyer
                ? 'Describe your practice so citizens know how you can help.'
                : 'Include your city/barangay (e.g. Davao City, Barangay X) so lawyers know your area.'
            }
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>
        </div>
      </section>

      {isCitizen && (
        <section className="settings-group">
          <div className="settings-group__intro">
            <h3 className="settings-group__label">Personal details</h3>
            <p className="settings-group__desc">
              Visible only to lawyers you book with.
            </p>
          </div>
          <div className="settings-group__card settings-group__card--pad">
          <div className="form-field">
            <label className="ox-label" htmlFor="settings-dob">Date of birth</label>
            <input
              id="settings-dob"
              className="ox-input"
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label className="ox-label" htmlFor="settings-gender">Gender</label>
            <select
              id="settings-gender"
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
          <div className="form-field">
            <label className="ox-label" htmlFor="settings-address">Address (city / barangay)</label>
            <input
              id="settings-address"
              className="ox-input"
              type="text"
              placeholder="e.g. Quezon City, Brgy. Fairview"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label className="ox-label" htmlFor="settings-civil-status">Civil status</label>
            <select
              id="settings-civil-status"
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
            <label className="ox-label" htmlFor="settings-occupation">Occupation</label>
            <input
              id="settings-occupation"
              className="ox-input"
              type="text"
              placeholder="e.g. Teacher, OFW, Freelancer"
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
            />
          </div>
          </div>
        </section>
      )}

      {isLawyer && (
        <section className="settings-group">
          <div className="settings-group__intro">
            <h3 className="settings-group__label">Practice</h3>
            <p className="settings-group__desc">
              Shown on your public counsel profile after identity verification.
            </p>
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
      )}

      <section className="settings-group">
        <div className="settings-group__intro">
          <h3 className="settings-group__label">Contact</h3>
        </div>
        <div className="settings-group__card settings-group__card--pad">
        <div className="form-field">
          <label className="ox-label" htmlFor="settings-email">Email</label>
          <input
            id="settings-email"
            className="ox-input input-readonly"
            type="email"
            value={user.email}
            readOnly
            aria-readonly
          />
        </div>
        <div className="form-field">
          <span className="ox-label">Phone</span>
          <div className="phone-split">
            <span className="phone-split__cc">+63</span>
            <input
              className="phone-split__input"
              type="tel"
              value={phoneDisplay}
              readOnly
              aria-readonly
            />
          </div>
        </div>
        </div>
      </section>

      <div className="settings-actions form-actions-bar">
        <button type="button" className="ox-btn ox-btn-danger" onClick={logout}>
          Sign out
        </button>
        <button className="ox-btn ox-btn-primary" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
    </div>
  );

  const sectionPanel = (title: string, children: React.ReactNode) => (
    <div className="settings-ac settings-ac--drill">
      <SectionBack onBack={goHub} title={title} />
      {children}
    </div>
  );

  return (
    <AppShell
      variant="flow"
      title="Account & Security"
      navItems={nav}
      stepLabel="Settings"
      backTo={getAppBackFallback(isLawyer)}
    >
      <div className="dash-layout dash-layout--settings">
        <DashSettingsIntro
          isLawyer={isLawyer}
          isVerifiedLawyer={user.isVerified}
          phoneVerified={!!user.phone}
          showProfilePreview={showProfilePreview}
          onToggleProfilePreview={() => setShowProfilePreview((v) => !v)}
        />

        {showProfilePreview && isCitizen && (
          <CitizenTrustPanel
            previewMode
            citizen={{
              id: user.id,
              name: name.trim() || user.name,
              avatarUrl: user.avatarUrl,
              bio: bio.trim() || user.bio,
              createdAt: user.createdAt,
              phone: user.phone,
            }}
            onClose={() => setShowProfilePreview(false)}
          />
        )}

        {showProfilePreview && isLawyer && (
          <LawyerProfilePreview user={user} draftName={name} draftBio={bio} />
        )}

        {isLawyer && (
          <div className="settings-segment" role="tablist" aria-label="Settings category">
            <button
              type="button"
              role="tab"
              aria-selected={lawyerTab === 'general'}
              className={`settings-segment__btn${lawyerTab === 'general' ? ' is-active' : ''}`}
              onClick={() => { setLawyerTab('general'); setView('hub'); }}
            >
              General
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={lawyerTab === 'booking'}
              className={`settings-segment__btn${lawyerTab === 'booking' ? ' is-active' : ''}`}
              onClick={() => setLawyerTab('booking')}
            >
              Booking
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={lawyerTab === 'earnings'}
              className={`settings-segment__btn${lawyerTab === 'earnings' ? ' is-active' : ''}`}
              onClick={() => setLawyerTab('earnings')}
            >
              Earnings
            </button>
          </div>
        )}

        {msg && (
          <div className={msgOk ? 'callout-success' : 'callout-error'} role="alert">
            <p className={msgOk ? 'callout-success__text' : 'callout-error__text'}>{msg}</p>
          </div>
        )}

        {isLawyer && lawyerTab === 'booking' ? (
          <LawyerBookingSettings onFeedback={setFeedback} />
        ) : isLawyer && lawyerTab === 'earnings' ? (
          <LawyerEarningsTab onFeedback={setFeedback} />
        ) : (
          <div className="settings-stack settings-stack--mock">
            {view === 'hub' && (
              <SettingsHub
                isLawyer={isLawyer}
                userName={user.name}
                avatarUrl={user.avatarUrl ?? null}
                phoneVerified={!!user.phone}
                isVerifiedLawyer={user.isVerified}
                onSelect={setView}
              />
            )}

            {view === 'profile' && profileForm}

            {view === 'verification' && sectionPanel('Verification', (
              <section className="settings-group">
                <div className="settings-group__intro">
                  <h3 className="settings-group__label">Identity</h3>
                  <p className="settings-group__desc">Your verified contact and counsel status.</p>
                </div>
                <div className="settings-group__card">
                  <div className="settings-info-row">
                    <span className="settings-info-row__label">Phone</span>
                    <span className="settings-info-row__value">Verified via SMS</span>
                  </div>
                  {isLawyer && (
                    <div className="settings-info-row">
                      <span className="settings-info-row__label">Counsel status</span>
                      <span className="settings-info-row__value">
                        {user.isVerified
                          ? 'Verified on Ordinex'
                          : user.lawyerVerificationStatus === 'PROCESSING'
                            ? 'AI confidence check in progress'
                            : user.lawyerVerificationStatus === 'NEEDS_REUPLOAD'
                              ? 'Re-upload required — borderline match'
                              : user.lawyerVerificationStatus === 'REJECTED'
                                ? 'Verification rejected — see cooldown below'
                                : 'Complete the verification wizard to earn the verified counsel badge'}
                      </span>
                    </div>
                  )}
                </div>
                {isLawyer && (
                  <div className="settings-group__extra">
                    <LawyerVerificationWizard
                      user={user}
                      onUpdated={(u) => { updateUser(u); void refreshUser(); }}
                    />
                    <h4 className="settings-group__label" style={{ marginTop: 24 }}>Supporting credentials</h4>
                    <p className="settings-group__desc">Optional documents that support your practice listing.</p>
                    <LawyerCredentialsPanel user={user} onUpdated={(u) => { updateUser(u); void refreshUser(); }} />
                  </div>
                )}
              </section>
            ))}

            {view === 'security' && sectionPanel('Security', (
              <section className="settings-group">
                <div className="settings-group__intro">
                  <h3 className="settings-group__label">Login & recovery</h3>
                  <p className="settings-group__desc">Manage your password and account timeline.</p>
                </div>
                <div className="settings-group__card">
                  <div className="settings-info-row">
                    <span className="settings-info-row__label">Password</span>
                    <span className="settings-info-row__value settings-password-dots">••••••••</span>
                  </div>
                  <p className="settings-info-note">Contact support to reset your password.</p>
                  <div className="settings-info-row">
                    <span className="settings-info-row__label">Member since</span>
                    <span className="settings-info-row__value">
                      {user.createdAt
                        ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </section>
            ))}

            {view === 'subscription' && isCitizen && sectionPanel('Billing', (
              <section className="settings-group">
                <div className="settings-group__intro">
                  <h3 className="settings-group__label">Payments</h3>
                  <p className="settings-group__desc">How you pay lawyers on Ordinex.</p>
                </div>
                <div className="settings-group__card settings-group__card--pad">
                  <p className="settings-info-row__label" style={{ marginBottom: 6 }}>Pay per consultation</p>
                  <p className="settings-group__desc" style={{ margin: 0 }}>
                    Ordinex has no monthly platform fee. When you book a lawyer, you pay their listed fee through the booking checkout.
                  </p>
                  <Link to="/lawyers" className="settings-pricing-link" style={{ marginTop: 16, display: 'block' }}>
                    <button type="button" className="ox-btn ox-btn-primary ox-btn-full">
                      Browse lawyers
                    </button>
                  </Link>
                </div>
              </section>
            ))}

            {view === 'privacy' && sectionPanel('Privacy', (
              <section className="settings-group">
                <div className="settings-group__intro">
                  <h3 className="settings-group__label">Your information</h3>
                  <p className="settings-group__desc">
                    Your data is used to run Ordinex — analyses, bookings, and consultations you start.
                    {isCitizen
                      ? ' Lawyers you book with see a limited client profile for that booking only — not a public directory.'
                      : ''}
                  </p>
                </div>
                <div className="settings-group__card">
                  <Link to="/privacy" className="settings-hub-row settings-hub-row--link">
                    <span className="settings-hub-row__body">
                      <strong className="settings-hub-row__title">Privacy Policy</strong>
                    </span>
                    <span className="settings-hub-row__chevron" aria-hidden>›</span>
                  </Link>
                  <Link to="/terms" className="settings-hub-row settings-hub-row--link">
                    <span className="settings-hub-row__body">
                      <strong className="settings-hub-row__title">Terms of Service</strong>
                    </span>
                    <span className="settings-hub-row__chevron" aria-hidden>›</span>
                  </Link>
                  <Link to="/licenses" className="settings-hub-row settings-hub-row--link">
                    <span className="settings-hub-row__body">
                      <strong className="settings-hub-row__title">Open-source licenses</strong>
                    </span>
                    <span className="settings-hub-row__chevron" aria-hidden>›</span>
                  </Link>
                </div>
              </section>
            ))}

            {view === 'records' && sectionPanel('Consultation records', (
              <section className="settings-group">
                <div className="settings-group__intro">
                  <h3 className="settings-group__label">Records</h3>
                  <p className="settings-group__desc">
                    Completed consultations can receive a tamper-evident record hash. Optional blockchain anchoring
                    may be applied on the server when a session is finalized.
                  </p>
                </div>
              </section>
            ))}

            {view === 'recycle' && (
              <RecycleBinPanel isLawyer={isLawyer} onBack={goHub} />
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default AccountSettings;
