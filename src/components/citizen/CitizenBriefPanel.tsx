import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  briefsApi,
  consultationApi,
  consultationDisplayTitle,
  type BriefInquiry,
  type CitizenBrief,
  type ConsultationResult,
} from '../../services/api';
import { getErrorMessage } from '../../utils/userFacingError';
import {
  CASE_ANALYSIS_CATEGORIES,
  buildLawyerBookPath,
  specialtyDisplayLabel,
} from '../../constants/legalCategories';
import { isCitizenBookingUnlocked } from '../../utils/trustScore';
import { useAuth } from '../../context/AuthContext';

const blankForm = () => ({
  category: 'unsure',
  summary: '',
  consultationId: '',
  budgetMin: '',
  budgetMax: '',
  anonymous: false,
});

export const CitizenBriefPanel: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const unlocked = isCitizenBookingUnlocked(user);
  const [brief, setBrief] = useState<CitizenBrief | null>(null);
  const [inquiries, setInquiries] = useState<BriefInquiry[]>([]);
  const [analyses, setAnalyses] = useState<ConsultationResult[]>([]);
  /** Form editor open — independent of published ticket visibility. */
  const [editing, setEditing] = useState(false);
  const [category, setCategory] = useState('unsure');
  const [summary, setSummary] = useState('');
  const [consultationId, setConsultationId] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const applyBlank = () => {
    const b = blankForm();
    setCategory(b.category);
    setSummary(b.summary);
    setConsultationId(b.consultationId);
    setBudgetMin(b.budgetMin);
    setBudgetMax(b.budgetMax);
    setAnonymous(b.anonymous);
  };

  const loadFormFromBrief = (b: CitizenBrief) => {
    setCategory(b.category || 'unsure');
    setSummary(b.summary || '');
    setConsultationId(b.consultationId || '');
    setBudgetMin(b.budgetMin != null ? String(b.budgetMin) : '');
    setBudgetMax(b.budgetMax != null ? String(b.budgetMax) : '');
    setAnonymous(Boolean(b.anonymous));
  };

  const refresh = () => {
    if (!unlocked) return;
    briefsApi.getMine()
      .then(({ brief: b }) => {
        setBrief(b);
        // Keep form collapsed after load — ticket shows published request.
        setEditing(false);
        applyBlank();
      })
      .catch(() => {});
    briefsApi.listInquiries()
      .then(({ inquiries: list }) => setInquiries(list.filter((i) => i.status === 'PENDING')))
      .catch(() => {});
    consultationApi.getHistory(1, 30)
      .then(({ consultations }) => setAnalyses(consultations))
      .catch(() => setAnalyses([]));
  };

  useEffect(() => { refresh(); }, [unlocked]);

  if (!unlocked) return null;

  const isLive = brief?.status === 'OPEN';
  const attachedAnalysis = analyses.find((c) => c.id === consultationId);
  const attachedLabel =
    brief?.analysisTitle
    || (attachedAnalysis ? consultationDisplayTitle(attachedAnalysis) : 'View analysis');

  const attachAnalysis = (id: string) => {
    setConsultationId(id);
    if (!id) return;
    const picked = analyses.find((c) => c.id === id);
    if (!picked) return;
    if (picked.category && picked.category !== 'unsure') {
      setCategory(picked.category);
    }
    if (!summary.trim() && picked.description?.trim()) {
      setSummary(picked.description.trim().slice(0, 280));
    }
  };

  const publish = async () => {
    setBusy(true);
    setError('');
    try {
      const { brief: saved } = await briefsApi.saveMine({
        category,
        summary,
        consultationId: consultationId || null,
        budgetMin: budgetMin ? Number(budgetMin) : null,
        budgetMax: budgetMax ? Number(budgetMax) : null,
        anonymous,
      });
      setBrief(saved);
      setEditing(false);
      applyBlank();
      setJustSubmitted(true);
      window.setTimeout(() => setJustSubmitted(false), 4000);
    } catch (e) {
      setError(getErrorMessage(e, 'Could not publish request.'));
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    setBusy(true);
    setError('');
    try {
      const { brief: saved } = await briefsApi.closeMine();
      setBrief(saved);
      setEditing(false);
      applyBlank();
    } catch (e) {
      setError(getErrorMessage(e, 'Could not close request.'));
    } finally {
      setBusy(false);
    }
  };

  const startNewOrEdit = (fromExisting: boolean) => {
    if (fromExisting && brief) loadFormFromBrief(brief);
    else applyBlank();
    setEditing(true);
    setJustSubmitted(false);
    setError('');
  };

  const ticketId = brief?.id ? brief.id.slice(0, 8).toUpperCase() : '';

  return (
    <div className="acct-section citizen-brief-panel">
      <div className="acct-section__head">
        <h2 className="acct-section__title">Looking for a lawyer</h2>
        {!editing && (
          <button
            type="button"
            className="ox-btn ox-btn-primary ox-btn-sm"
            onClick={() => startNewOrEdit(Boolean(isLive))}
          >
            {isLive ? 'Edit request' : 'New request'}
          </button>
        )}
      </div>
      <div className="acct-section__body citizen-brief-panel__body">
        <p className="staff-empty-hint citizen-brief-panel__hint">
          Optional. Verified lawyers can send a consult offer. Chat still starts only after you book and pay.
        </p>

        {justSubmitted && (
          <p className="staff-alert staff-alert--success citizen-brief-panel__flash" role="status">
            Request submitted. It is now pending for verified lawyers.
          </p>
        )}

        {/* Pending ticket — confirmation that the request is live */}
        {isLive && !editing && (
          <div className="staff-card-row citizen-brief-panel__ticket">
            <div className="citizen-brief-panel__ticket-head">
              <div>
                <p className="staff-card-row__title citizen-brief-panel__ticket-id">
                  Ticket #{ticketId}
                </p>
                <p className="staff-card-row__meta">
                  Status: <strong>Pending</strong>
                  {' · '}
                  Visible to verified lawyers
                </p>
              </div>
              <span className="dir-lawyer-card__spec">Pending</span>
            </div>
            <p className="staff-card-row__meta citizen-brief-panel__ticket-summary">
              {specialtyDisplayLabel(brief.category)} — {brief.summary}
            </p>
            {(brief.budgetMin != null || brief.budgetMax != null) && (
              <p className="staff-card-row__meta">
                Budget:{' '}
                {brief.budgetMin != null ? `₱${brief.budgetMin}` : '—'}
                {' – '}
                {brief.budgetMax != null ? `₱${brief.budgetMax}` : '—'}
              </p>
            )}
            {brief.consultationId && (
              <p className="staff-card-row__meta">
                Linked analysis:{' '}
                <Link to={`/ai-analysis?id=${brief.consultationId}`} className="link-inline">
                  {brief.analysisTitle || 'View'}
                </Link>
              </p>
            )}

            <div className="citizen-brief-panel__visitors">
              <p className="ox-label citizen-brief-panel__visitors-label">
                Visitors ({brief.viewCount ?? brief.viewers?.length ?? 0})
              </p>
              {(brief.viewers?.length ?? 0) === 0 ? (
                <p className="staff-empty-hint" style={{ margin: 0 }}>
                  No lawyers have viewed this request yet.
                </p>
              ) : (
                <ul className="citizen-brief-panel__visitor-list">
                  {brief.viewers!.map((v) => (
                    <li key={v.lawyerId} className="staff-card-row__meta">
                      {v.name}
                      {' · '}
                      {new Date(v.viewedAt).toLocaleString()}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="citizen-brief-panel__ticket-actions">
              <button type="button" className="ox-btn ox-btn-ghost ox-btn-sm" disabled={busy} onClick={() => void close()}>
                Close request
              </button>
            </div>
          </div>
        )}

        {!isLive && !editing && (
          <p className="staff-empty-hint" style={{ marginBottom: 0 }}>
            No open request. Tap <strong>New request</strong> to publish one.
          </p>
        )}

        {editing && (
          <>
            <label className="ox-label" htmlFor="brief-cat">Category</label>
            <select id="brief-cat" className="ox-input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CASE_ANALYSIS_CATEGORIES.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
            <label className="ox-label" htmlFor="brief-sum" style={{ marginTop: 8 }}>What you need</label>
            <textarea
              id="brief-sum"
              className="ox-input"
              rows={2}
              maxLength={280}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Short description. Do not include private documents or full case files."
            />
            <label className="ox-label" htmlFor="brief-analysis" style={{ marginTop: 8 }}>
              Attach case identification (optional)
            </label>
            <select
              id="brief-analysis"
              className="ox-input"
              value={consultationId}
              onChange={(e) => attachAnalysis(e.target.value)}
            >
              <option value="">No analysis attached</option>
              {analyses.map((c) => (
                <option key={c.id} value={c.id}>
                  {consultationDisplayTitle(c)} · {c.category} · {new Date(c.createdAt).toLocaleDateString()}
                </option>
              ))}
            </select>
            {analyses.length === 0 && (
              <p className="staff-empty-hint" style={{ marginTop: 6 }}>
                No saved analyses yet.{' '}
                <Link to="/ai-analysis" className="link-inline">Run case identification</Link>
                {' '}first, then attach it here.
              </p>
            )}
            {consultationId && (
              <p className="staff-empty-hint" style={{ marginTop: 6 }}>
                Linked:{' '}
                <Link to={`/ai-analysis?id=${consultationId}`} className="link-inline">
                  {attachedLabel}
                </Link>
                .
              </p>
            )}
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
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button type="button" className="ox-btn ox-btn-primary ox-btn-sm" disabled={busy} onClick={() => void publish()}>
                {isLive ? 'Update request' : 'Publish request'}
              </button>
              <button
                type="button"
                className="ox-btn ox-btn-ghost ox-btn-sm"
                disabled={busy}
                onClick={() => {
                  setEditing(false);
                  applyBlank();
                  setError('');
                }}
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {inquiries.length > 0 && (
          <div className="citizen-brief-panel__offers">
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
                        navigate(buildLawyerBookPath(lawyerId, brief?.consultationId));
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
