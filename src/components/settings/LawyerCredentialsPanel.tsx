import React, { useState } from 'react';
import { profileApi, type UserProfile } from '../../services/api';
import { getErrorMessage } from '../../utils/userFacingError';

interface Credential {
  id: string;
  title: string;
  description?: string;
  fileUrl: string;
}

interface Props {
  readonly user: UserProfile;
  readonly onUpdated: (user: UserProfile) => void;
}

export const LawyerCredentialsPanel: React.FC<Props> = ({ user, onUpdated }) => {
  const creds: Credential[] = Array.isArray(user.credentials) ? user.credentials : [];
  const [title, setTitle] = useState('Bar certificate');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const upload = async () => {
    if (!file || !title.trim()) {
      setError('Choose a document title and file.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { user: next } = await profileApi.addCredential(file, title.trim());
      onUpdated(next);
      setFile(null);
    } catch (e) {
      setError(getErrorMessage(e, 'Upload failed.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      const { user: next } = await profileApi.removeCredential(id);
      onUpdated(next);
    } catch (e) {
      setError(getErrorMessage(e, 'Could not remove credential.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lawyer-credentials-panel">
      <p className="workbench-panel-helper">
        Upload ID, bar certificate, or IBP proof to increase verification and directory trust.
      </p>
      <ul className="lawyer-credentials-list">
        {creds.map((c) => (
          <li key={c.id} className="lawyer-credentials-list__item">
            <span className="material-symbols-outlined">verified</span>
            <span>{c.title}</span>
            <button type="button" className="ox-btn-ghost-icon" disabled={busy} onClick={() => void remove(c.id)}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="lawyer-credentials-upload">
        <input
          className="ox-input"
          placeholder="Document label (e.g. IBP ID)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          type="file"
          accept="image/*,.pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <button type="button" className="ox-btn ox-btn-secondary" disabled={busy} onClick={() => void upload()}>
          {busy ? 'Uploading…' : 'Add credential'}
        </button>
      </div>
      {error && <p className="landing-form-error">{error}</p>}
    </div>
  );
};

export default LawyerCredentialsPanel;
