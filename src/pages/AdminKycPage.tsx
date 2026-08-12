import React, { useEffect, useState } from 'react';
import { AppShell } from '../components/shell/AppShell';
import { useAuth } from '../context/AuthContext';
import { getToken } from '../services/api';

type KycItem = {
  id: string;
  name: string;
  email: string;
  phone: string;
  barNumber: string | null;
  lawyerVerificationStatus: string;
  lawyerVerificationScore: number | null;
  lawyerVerification: { submittedRollNumber?: string; decisionReason?: string } | null;
};

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

/** Minimal admin KYC review — email must be in server ADMIN_EMAILS */
export const AdminKycPage: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<KycItem[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setError('');
    try {
      const res = await adminFetch<{ items: KycItem[] }>('/admin/kyc/pending');
      setItems(res.items || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load KYC queue');
      setItems([]);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const act = async (id: string, action: 'approve' | 'reject') => {
    setBusy(id);
    try {
      await adminFetch(`/admin/kyc/${id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({
          reason: action === 'reject' ? 'Documents insufficient — please re-upload.' : undefined,
        }),
      });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  if (!user) return null;

  return (
    <AppShell title="Admin" stepLabel="KYC review" navItems={[]} backTo="/dashboard">
      <div className="settings-ac" style={{ maxWidth: 720 }}>
        <h1 className="settings-ac-intro__title">Counsel verification queue</h1>
        <p className="settings-ac-intro__desc">
          Review borderline KYC cases. Add your email to server <code>ADMIN_EMAILS</code>.
        </p>
        {error && <p className="callout-error__text" role="alert">{error}</p>}
        {items.length === 0 && !error && (
          <p className="settings-group__desc">No pending verifications.</p>
        )}
        <div className="settings-group__card">
          {items.map((item) => (
            <div key={item.id} className="settings-info-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <strong>{item.name}</strong>
              <span className="settings-info-row__value" style={{ textAlign: 'left' }}>
                {item.email} · {item.lawyerVerificationStatus}
                {item.lawyerVerificationScore != null ? ` · score ${Math.round(item.lawyerVerificationScore)}` : ''}
                {item.lawyerVerification?.submittedRollNumber
                  ? ` · roll ${item.lawyerVerification.submittedRollNumber}`
                  : ''}
              </span>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  className="ox-btn ox-btn-primary"
                  disabled={busy === item.id}
                  onClick={() => void act(item.id, 'approve')}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="ox-btn ox-btn-danger"
                  disabled={busy === item.id}
                  onClick={() => void act(item.id, 'reject')}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
};

export default AdminKycPage;
