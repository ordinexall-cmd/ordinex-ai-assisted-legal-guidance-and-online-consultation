import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../components/shell/AppShell';
import { LinkedInProfileHeader } from '../components/profile/LinkedInProfileHeader';
import { AnalysisResultsCitizen } from '../components/analysis/AnalysisResultsCitizen';
import { useAuth } from '../context/AuthContext';
import { getLawyerNav } from '../utils/lawyerWorkspace';
import { getErrorMessage } from '../utils/userFacingError';
import {
  briefsApi,
  type BookingLinkedAnalysis,
  type CitizenBrief,
  type LegalAnalysisResult,
} from '../services/api';
import { specialtyDisplayLabel } from '../constants/legalCategories';
import { LawyerProfileSkeleton } from '../components/dashboard/LawyerProfileSkeleton';

function placeLabel(b: CitizenBrief): string {
  const parts = [b.city, b.province].filter(Boolean);
  return parts.length ? parts.join(', ') : 'Philippines';
}

function budgetLabel(b: CitizenBrief): string {
  if (b.budgetMin == null && b.budgetMax == null) return 'Budget flexible';
  if (b.budgetMin != null && b.budgetMax != null && b.budgetMin !== b.budgetMax) {
    return `₱${b.budgetMin.toLocaleString()} – ₱${b.budgetMax.toLocaleString()}`;
  }
  const n = b.budgetMin ?? b.budgetMax;
  return n == null ? 'Budget flexible' : `₱${n.toLocaleString()}`;
}

export const BriefRequestDetail: React.FC = () => {
  const { briefId } = useParams<{ briefId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const navItems = getLawyerNav(user);

  const [brief, setBrief] = useState<CitizenBrief | null>(null);
  const [citizen, setCitizen] = useState<{ displayName: string; avatarUrl: string | null } | null>(null);
  const [analysis, setAnalysis] = useState<BookingLinkedAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [offerDone, setOfferDone] = useState(false);

  useEffect(() => {
    if (!briefId) return;
    setLoading(true);
    setError('');
    briefsApi
      .getById(briefId)
      .then((data) => {
        setBrief(data.brief);
        setCitizen(data.citizen);
        setAnalysis(data.analysis);
        setOfferDone(Boolean(data.brief.myOfferStatus));
      })
      .catch((err) => setError(getErrorMessage(err, 'Request not found.')))
      .finally(() => setLoading(false));
  }, [briefId]);

  if (!briefId) return <Navigate to="/directory" replace />;

  const sendOffer = async () => {
    if (!brief) return;
    setBusy(true);
    setError('');
    try {
      await briefsApi.offer(brief.id, note.trim());
      setOfferDone(true);
      setBrief({ ...brief, myOfferStatus: 'PENDING' });
    } catch (err) {
      setError(getErrorMessage(err, 'Could not send offer.'));
    } finally {
      setBusy(false);
    }
  };

  const ar: LegalAnalysisResult | null = analysis?.aiResult ?? null;
  const displayName = citizen?.displayName || brief?.displayName || 'Citizen';

  return (
    <AppShell
      variant="flow"
      title="Open request"
      navItems={navItems}
      stepLabel="Request"
      backTo="/directory"
    >
      <div className="staff-workspace marketplace">
        {loading && <LawyerProfileSkeleton />}

        {error && !loading && !brief && (
          <div className="staff-panel">
            <p className="staff-alert staff-alert--error">{error}</p>
            <button type="button" className="ox-btn ox-btn-ghost" onClick={() => navigate('/directory')}>
              Back to directory
            </button>
          </div>
        )}

        {brief && !loading && (
          <div>
            <LinkedInProfileHeader
              name={displayName}
              role="CITIZEN"
              avatarUrl={citizen?.avatarUrl}
              isVerified
              trustScore={80}
              headline={specialtyDisplayLabel(brief.category)}
              location={placeLabel(brief)}
              isOwnProfile={false}
            />

            <section className="ox-card" style={{ padding: '1.25rem 1.35rem', marginBottom: '1.25rem' }}>
              <h2 className="acct-section__title" style={{ marginTop: 0 }}>Request details</h2>
              <p className="staff-empty-hint" style={{ marginBottom: 8 }}>
                {specialtyDisplayLabel(brief.category)} · {budgetLabel(brief)}
              </p>
              <p style={{ margin: 0, lineHeight: 1.55, color: '#334155' }}>{brief.summary}</p>
              {(brief.hasLinkedAnalysis || brief.consultationId) && brief.analysisTitle && (
                <p className="staff-empty-hint" style={{ marginTop: 10 }}>
                  Linked case identification: {brief.analysisTitle}
                </p>
              )}
            </section>

            {analysis && ar && (
              <section
                className="ox-card booking-linked-analysis"
                style={{ marginBottom: '1.25rem' }}
                aria-labelledby="brief-linked-analysis-title"
              >
                <header className="booking-linked-analysis__head">
                  <span className="material-symbols-outlined" aria-hidden>psychology</span>
                  <div>
                    <h3 id="brief-linked-analysis-title" className="booking-linked-analysis__title">
                      Linked case identification
                    </h3>
                    <p className="booking-linked-analysis__hint">
                      Review before offering consult — the citizen attached this as legal context.
                    </p>
                  </div>
                </header>
                {analysis.fileUrl && (
                  <p className="booking-linked-analysis__hint" style={{ marginBottom: 12 }}>
                    Citizen uploaded document:{' '}
                    <a href={analysis.fileUrl} target="_blank" rel="noreferrer">
                      Open attached file
                    </a>
                  </p>
                )}
                <AnalysisResultsCitizen
                  ar={ar}
                  meta={analysis.analysisMeta}
                  category={analysis.category}
                  consultationId={analysis.id}
                  defaultShowDetails
                  isLawyerView
                />
              </section>
            )}

            <section className="acct-section">
              <div className="acct-section__head">
                <h2 className="acct-section__title">Offer consult</h2>
              </div>
              <div className="acct-section__body" style={{ padding: '0.85rem 1rem' }}>
                {offerDone || brief.myOfferStatus ? (
                  <p className="staff-empty-hint">Offer sent. Chat opens after they book and pay.</p>
                ) : (
                  <>
                    <label className="ox-label" htmlFor="brief-offer-note">Optional note</label>
                    <textarea
                      id="brief-offer-note"
                      className="ox-input"
                      rows={3}
                      maxLength={200}
                      placeholder="e.g. I handle labor cases in Davao."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                    <p className="staff-empty-hint">This is a request, not a chat. Chat opens after they book and pay.</p>
                    {error && <p className="landing-form-error">{error}</p>}
                    <button
                      type="button"
                      className="ox-btn ox-btn-primary"
                      style={{ marginTop: 8 }}
                      disabled={busy}
                      onClick={() => { void sendOffer(); }}
                    >
                      {busy ? 'Sending…' : 'Send offer'}
                    </button>
                  </>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default BriefRequestDetail;
