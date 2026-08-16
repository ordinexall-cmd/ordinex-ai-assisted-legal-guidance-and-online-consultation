import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { briefsApi, type BriefInquiry, type CitizenBrief } from '../../services/api';
import { getErrorMessage } from '../../utils/userFacingError';
import { LEGAL_PRACTICE_AREAS, buildLawyerBookPath } from '../../constants/legalCategories';
import { isCitizenBookingUnlocked } from '../../utils/trustScore';
import { useAuth } from '../../context/AuthContext';

export const CitizenBriefPanel: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const unlocked = isCitizenBookingUnlocked(user);
  const [brief, setBrief] = useState<CitizenBrief | null>(null);
  const [inquiries, setInquiries] = useState<BriefInquiry[]>([]);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('Family');
  const [summary, setSummary] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    if (!unlocked) return;
    briefsApi.getMine()
      .then(({ brief: b }) => {
        setBrief(b);
        setOpen(b?.status === 'OPEN');
        if (b) {
          setCategory(b.category);
          setSummary(b.summary);
          setBudgetMin(b.budgetMin != null ? String(b.budgetMin) : '');
          setBudgetMax(b.budgetMax != null ? String(b.budgetMax) : '');
          setAnonymous(Boolean(b.anonymous));
        }
      })
      .catch(() => {});
    briefsApi.listInquiries()
      .then(({ inquiries: list }) => setInquiries(list.filter((i) => i.status === 'PENDING')))
      .catch(() => {});
  };

  useEffect(() => { refresh(); }, [unlocked]);

  if (!unlocked) return null;

  const publish = async () => {
    setBusy(true);
    setError('');
    try {
      const { brief: saved } = await briefsApi.saveMine({
        category,
        summary,
        budgetMin: budgetMin ? Number(budgetMin) : null,
        budgetMax: budgetMax ? Number(budgetMax) : null,
        anonymous,
      });
      setBrief(saved);
      setOpen(true);
    } catch (e) {
      setError(getErrorMessage(e, 'Could not publish request.'));
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    setBusy(true);
    try {
      const { brief: saved } = await briefsApi.closeMine();
      setBrief(saved);
      setOpen(false);
    } catch (e) {
      setError(getErrorMessage(e, 'Could not close request.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="acct-section" style={{ marginBottom: '1rem' }}>
      <div className="acct-section__head">
        <h2 className="acct-section__title">Looking for a lawyer</h2>
        <label className="marketplace-filter-bar__toggle">
          <input
            type="checkbox"
            checked={open}
            onChange={(e) => {
              if (!e.target.checked) void close();
              else setOpen(true);
            }}
          />
          Visible to verified lawyers
        </label>
      </div>
      <div className="acct-section__body" style={{ padding: '0.85rem 1rem' }}>
        <p className="staff-empty-hint" style={{ marginTop: 0 }}>
          Optional. Verified lawyers can send a consult offer. Chat still starts only after you book and pay.
        </p>
        {open && (
          <>
            <label className="ox-label" htmlFor="brief-cat">Category</label>
            <select id="brief-cat" className="ox-input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {LEGAL_PRACTICE_AREAS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
            <label className="ox-label" htmlFor="brief-sum" style={{ marginTop: 8 }}>What you need</label>
            <textarea
              id="brief-sum"
              className="ox-input"
              rows={3}
              maxLength={280}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Short description. Do not include private documents or full case files."
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
              <div>
                <label className="ox-label" htmlFor="brief-min">Budget min (optional)</label>
                <input id="brief-min" className="ox-input" type="number" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} />
              </div>
              <div>
                <label className="ox-label" htmlFor="brief-max">Budget max (optional)</label>
                <input id="brief-max" className="ox-input" type="number" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} />
              </div>
            </div>
            <label className="marketplace-filter-bar__toggle" style={{ marginTop: 8 }}>
              <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
              Use Anonymous instead of my first name
            </label>
            {error && <p className="staff-alert staff-alert--error" role="alert">{error}</p>}
            <button type="button" className="ox-btn ox-btn-primary ox-btn-sm" style={{ marginTop: 10 }} disabled={busy} onClick={() => void publish()}>
              {brief?.status === 'OPEN' ? 'Update request' : 'Publish request'}
            </button>
          </>
        )}

        {inquiries.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <p className="ox-label">Consult offers</p>
            {inquiries.map((i) => (
              <div key={i.id} className="staff-card-row" style={{ marginTop: 8 }}>
                <p className="staff-card-row__title">{i.lawyer.name}</p>
                <p className="staff-card-row__meta">{i.message || 'Offered a consultation.'}</p>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    className="ox-btn ox-btn-primary ox-btn-sm"
                    onClick={() => {
                      void briefsApi.acceptInquiry(i.id).then(({ lawyerId }) => {
                        navigate(buildLawyerBookPath(lawyerId));
                      });
                    }}
                  >
                    Accept and book
                  </button>
                  <button
                    type="button"
                    className="ox-btn ox-btn-ghost ox-btn-sm"
                    onClick={() => {
                      void briefsApi.declineInquiry(i.id).then(() => {
                        setInquiries((prev) => prev.filter((x) => x.id !== i.id));
                      });
                    }}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
