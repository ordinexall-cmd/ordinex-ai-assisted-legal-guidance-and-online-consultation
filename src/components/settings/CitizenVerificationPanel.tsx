import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authApi, assetUrl } from '../../services/api';
import { getErrorMessage } from '../../utils/userFacingError';

const CITIZEN_ID_OPTIONS = [
  { value: 'PHILID', label: 'Philippine National ID (PhilSys)' },
  { value: 'DRIVERS_LICENSE', label: "Driver's License (LTO)" },
  { value: 'PASSPORT', label: 'Philippine Passport (DFA)' },
  { value: 'STUDENT_ID', label: 'Student ID (Valid School / University ID)' },
  { value: 'UMID', label: 'Unified Multi-Purpose ID (UMID / SSS)' },
  { value: 'POSTAL', label: 'Postal ID' },
  { value: 'VOTER', label: "Voter's ID / Certificate (COMELEC)" },
  { value: 'OTHER_GOV', label: 'Other Government-Issued ID' },
];

export interface CitizenVerificationPanelProps {
  onSuccess?: () => void;
}

export const CitizenVerificationPanel: React.FC<CitizenVerificationPanelProps> = ({ onSuccess }) => {
  const { user, refreshUser } = useAuth();
  const [idType, setIdType] = useState<string>(user?.citizenIdType || 'PHILID');
  const [idNumber, setIdNumber] = useState<string>(user?.citizenIdNumber || '');
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(assetUrl(user?.citizenIdUrl) || null);
  const [backPreview, setBackPreview] = useState<string | null>(assetUrl(user?.citizenIdBackUrl) || null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(assetUrl(user?.citizenSelfieUrl) || null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; isError: boolean } | null>(null);

  const isVerified = user?.isVerified || user?.citizenVerificationStatus === 'VERIFIED';

  const handleFrontChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFrontFile(file);
      setFrontPreview(URL.createObjectURL(file));
      setFeedback(null);
    }
  };

  const handleBackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBackFile(file);
      setBackPreview(URL.createObjectURL(file));
    }
  };

  const handleSelfieChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelfieFile(file);
      setSelfiePreview(URL.createObjectURL(file));
      setFeedback(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!frontFile && !user?.citizenIdUrl) {
      setFeedback({ message: 'Please upload a photo of your ID.', isError: true });
      return;
    }
    if (!selfieFile) {
      setFeedback({ message: 'Please upload a selfie holding the same ID.', isError: true });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const formData = new FormData();
      formData.append('idType', idType);
      formData.append('idNumber', idNumber.trim());
      if (frontFile) formData.append('front', frontFile);
      if (backFile) formData.append('back', backFile);
      formData.append('selfie', selfieFile);

      const res = await authApi.submitCitizenVerification(formData);
      await refreshUser();
      setFeedback({
        message: res.message || 'Identity documents verified. Complete remaining profile checks to reach Trust 100.',
        isError: false,
      });
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setFeedback({
        message: getErrorMessage(err, 'Failed to verify ID. Please ensure the image is clear and details match your profile.'),
        isError: true,
      });
    } finally {
      setLoading(false);
    }
  };

  if (isVerified) {
    return (
      <div className="settings-panel-card" style={{ padding: '1.5rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '2rem', color: '#004D40' }}>
            verified_user
          </span>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>Identity Verified</h3>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
              Your government ID is on file. Reach Trust 100 / 100 in settings to unlock lawyer booking.
            </p>
          </div>
        </div>

        <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid #edf2f7', marginTop: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ID Type</span>
              <p style={{ margin: '0.25rem 0 0', fontWeight: 600, color: '#1e293b' }}>
                {CITIZEN_ID_OPTIONS.find((o) => o.value === (user?.citizenIdType || idType))?.label || user?.citizenIdType || 'Government ID'}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ID Number</span>
              <p style={{ margin: '0.25rem 0 0', fontWeight: 600, color: '#1e293b' }}>
                {user?.citizenIdNumber || 'Verified on file'}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Verification Status</span>
              <p style={{ margin: '0.25rem 0 0', fontWeight: 600, color: '#004D40', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>check_circle</span>
                Active (RA 10173 Protected)
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-panel-card" style={{ padding: '1.5rem', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>Citizen Identity Verification</h3>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#64748b' }}>
          Upload a valid Philippine government ID and a selfie holding that same ID. We match the name on the ID to your profile and compare the ID photo to your selfie.
        </p>
      </div>

      {feedback && (
        <div
          role="alert"
          style={{
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            borderRadius: '6px',
            background: feedback.isError ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${feedback.isError ? '#fecaca' : '#bbf7d0'}`,
            color: feedback.isError ? '#991b1b' : '#166534',
            fontSize: '0.875rem',
          }}
        >
          {feedback.message}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <label className="ox-label" htmlFor="citizen-id-type" style={{ display: 'block', marginBottom: '0.35rem' }}>
              Select ID Type <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <select
              id="citizen-id-type"
              className="ox-input"
              value={idType}
              onChange={(e) => setIdType(e.target.value)}
              required
            >
              {CITIZEN_ID_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="ox-label" htmlFor="citizen-id-num" style={{ display: 'block', marginBottom: '0.35rem' }}>
              ID / Student Number (Optional)
            </label>
            <input
              id="citizen-id-num"
              type="text"
              className="ox-input"
              placeholder="e.g. 1234-5678-9012 or Student No."
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
          <div>
            <label className="ox-label" htmlFor="citizen-id-front" style={{ display: 'block', marginBottom: '0.35rem' }}>
              Front of ID Photo <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <div
              style={{
                border: '2px dashed #cbd5e1',
                borderRadius: '6px',
                padding: '1rem',
                textAlign: 'center',
                background: '#f8fafc',
                cursor: 'pointer',
                position: 'relative',
              }}
              onClick={() => document.getElementById('citizen-id-front')?.click()}
            >
              {frontPreview ? (
                <img
                  src={frontPreview}
                  alt="Front ID preview"
                  style={{ maxHeight: '140px', maxWidth: '100%', objectFit: 'contain', borderRadius: '4px' }}
                />
              ) : (
                <div style={{ padding: '1rem 0' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', color: '#94a3b8' }}>
                    add_photo_alternate
                  </span>
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#475569' }}>
                    Click or drag front ID photo
                  </p>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>JPG, PNG, WebP up to 6MB</span>
                </div>
              )}
              <input
                id="citizen-id-front"
                type="file"
                accept="image/png, image/jpeg, image/webp"
                style={{ display: 'none' }}
                onChange={handleFrontChange}
              />
            </div>
          </div>

          <div>
            <label className="ox-label" htmlFor="citizen-id-back" style={{ display: 'block', marginBottom: '0.35rem' }}>
              Back of ID Photo (Optional)
            </label>
            <div
              style={{
                border: '2px dashed #cbd5e1',
                borderRadius: '6px',
                padding: '1rem',
                textAlign: 'center',
                background: '#f8fafc',
                cursor: 'pointer',
                position: 'relative',
              }}
              onClick={() => document.getElementById('citizen-id-back')?.click()}
            >
              {backPreview ? (
                <img
                  src={backPreview}
                  alt="Back ID preview"
                  style={{ maxHeight: '140px', maxWidth: '100%', objectFit: 'contain', borderRadius: '4px' }}
                />
              ) : (
                <div style={{ padding: '1rem 0' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', color: '#94a3b8' }}>
                    add_photo_alternate
                  </span>
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#475569' }}>
                    Click or drag back ID photo
                  </p>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Optional if single-sided ID</span>
                </div>
              )}
              <input
                id="citizen-id-back"
                type="file"
                accept="image/png, image/jpeg, image/webp"
                style={{ display: 'none' }}
                onChange={handleBackChange}
              />
            </div>
          </div>

          <div>
            <label className="ox-label" htmlFor="citizen-id-selfie" style={{ display: 'block', marginBottom: '0.35rem' }}>
              Selfie holding the ID <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <div
              style={{
                border: '2px dashed #cbd5e1',
                borderRadius: '6px',
                padding: '1rem',
                textAlign: 'center',
                background: '#f8fafc',
                cursor: 'pointer',
                position: 'relative',
              }}
              onClick={() => document.getElementById('citizen-id-selfie')?.click()}
            >
              {selfiePreview ? (
                <img
                  src={selfiePreview}
                  alt="Selfie with ID preview"
                  style={{ maxHeight: '140px', maxWidth: '100%', objectFit: 'contain', borderRadius: '4px' }}
                />
              ) : (
                <div style={{ padding: '1rem 0' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', color: '#94a3b8' }}>
                    face
                  </span>
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#475569' }}>
                    Hold the same ID next to your face
                  </p>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>JPG, PNG, WebP up to 6MB</span>
                </div>
              )}
              <input
                id="citizen-id-selfie"
                type="file"
                accept="image/png, image/jpeg, image/webp"
                style={{ display: 'none' }}
                onChange={handleSelfieChange}
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1rem', verticalAlign: 'middle', marginRight: '0.25rem' }}>
              shield
            </span>
            Processed under Philippine Data Privacy Act (RA 10173) solely for consultation identity.
          </p>
          <button
            type="submit"
            className="ox-btn ox-btn-primary"
            disabled={loading || (!frontFile && !user?.citizenIdUrl) || !selfieFile}
          >
            {loading ? 'Checking ID and selfie…' : 'Submit ID and selfie'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CitizenVerificationPanel;
