import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../components/shell/AppShell';
import { consultationApi, consultationDisplayTitle } from '../services/api';
import { getCitizenNav } from '../utils/citizenWorkspace';
import { AnalysisResultsCitizen } from '../components/analysis/AnalysisResultsCitizen';
import { outlookPill } from '../components/dashboard/outlookPill';
import { ConsultationRowActions } from '../components/ConsultationRowActions';
import { ApiLoadBanner } from '../components/ui/ApiLoadBanner';
import { loadErrorMessage } from '../utils/loadErrorMessage';
import { buildLawyersPath, resolveMatchSpecialty } from '../constants/legalCategories';

export const AnalysisDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [item, setItem] = useState<Awaited<ReturnType<typeof consultationApi.getById>>['consultation'] | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    consultationApi.getById(id)
      .then((r) => setItem(r.consultation))
      .catch((e) => setError(loadErrorMessage(e, 'Could not load this analysis.')))
      .finally(() => setLoading(false));
  }, [id]);

  const ar = item?.aiResult;

  return (
    <AppShell
      variant="flow"
      title="Analysis detail"
      navItems={getCitizenNav()}
      stepLabel="Detail"
      backTo="/analyses"
    >
      {loading && <p className="analysis-describe__hint">Loading…</p>}
      {error && <ApiLoadBanner message={error} onRetry={() => navigate(0)} />}
      {!loading && item && !ar && (
        <div className="analysis-detail-clean">
          <div className="analysis-describe__empty">
            <h3>Analysis unavailable</h3>
            <p>This analysis record is missing details or may have been removed.</p>
            <Link to="/analyses" className="list-panel__link">Back to analyses</Link>
          </div>
        </div>
      )}
      {!loading && item && ar && (
        <div className="analysis-detail-clean">
          <div className="analysis-describe__summary-strip">
            <div style={{ flex: 1, minWidth: 0 }}>
              <span className="label">Analysis</span>
              <p style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <strong>{consultationDisplayTitle(item)}</strong>
                {outlookPill(ar.courtWinOutlook.level)}
              </p>
              <p className="analysis-detail-clean__meta" style={{ marginTop: 4, marginBottom: 0 }}>
                {item.category} · {new Date(item.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="analysis-describe__toolbar" style={{ marginBottom: 0 }}>
              <ConsultationRowActions
                item={item}
                onUpdated={() => {
                  if (id) consultationApi.getById(id).then((r) => setItem(r.consultation));
                }}
                onDeleted={() => navigate('/analyses')}
              />
              <Link to="/ai-analysis" className="ox-btn ox-btn-ghost">New analysis</Link>
            </div>
          </div>

          {ar._supersededWarning && (
            <div className="complex-case-banner complex-case-banner--stale" role="alert">
              <div className="complex-case-banner__icon">
                <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#c0392b' }}>history_toggle_off</span>
              </div>
              <div className="complex-case-banner__body">
                <p className="complex-case-banner__title">Source freshness caution</p>
                <p className="complex-case-banner__text">
                  Some of the matched legal references have been amended or repealed.
                  Treat these results as preliminary and confirm with a licensed lawyer before acting.
                </p>
              </div>
            </div>
          )}

          {ar._complexCase && (
            <div className="complex-case-banner" role="alert">
              <div className="complex-case-banner__icon">
                <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#e6a817' }}>info</span>
              </div>
              <div className="complex-case-banner__body">
                <p className="complex-case-banner__title">Need a professional opinion?</p>
                <p className="complex-case-banner__text">
                  This situation may need specialized legal rules beyond our verified library.
                  We recommend booking a consultation with a licensed lawyer.
                </p>
                <Link
                  to={buildLawyersPath({
                    specialty: resolveMatchSpecialty({
                      category: item.category,
                      lawyerSpecialty: ar.lawyerSpecialty,
                      matchSpecialty: ar.matchSpecialty,
                    }),
                    consultationId: item.id,
                  })}
                  className="complex-case-banner__cta"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person_search</span>
                  Find a lawyer
                </Link>
              </div>
            </div>
          )}

          <AnalysisResultsCitizen
            ar={ar}
            meta={item.analysisMeta}
            category={item.category}
            consultationId={item.id}
          />
        </div>
      )}
    </AppShell>
  );
};

export default AnalysisDetail;
