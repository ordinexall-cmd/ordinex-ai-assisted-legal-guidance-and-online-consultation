import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/shell/AppShell';
import { consultationApi, consultationDisplayTitle, type ConsultationResult } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getCitizenNav } from '../utils/citizenWorkspace';
import { getAppBackFallback } from '../utils/navigation';
import { DashHistorySkeleton } from '../components/dashboard/DashHistorySkeleton';
import { DashHistoryEmpty } from '../components/dashboard/DashHistoryEmpty';
import { outlookPill } from '../components/dashboard/outlookPill';
import type { CourtWinLevel } from '../services/api';
import { ConsultationRowActions } from '../components/ConsultationRowActions';
import { ApiLoadBanner } from '../components/ui/ApiLoadBanner';
import { loadErrorMessage } from '../utils/loadErrorMessage';

export const AnalysisHistoryList: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const [query, setQuery] = useState(q);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ConsultationResult[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await consultationApi.getHistory(page, 15, q || undefined);
      setItems(res.consultations);
      setTotalPages(res.pagination?.totalPages ?? 1);
    } catch (e) {
      setItems([]);
      setError(loadErrorMessage(e, 'Could not load analysis history.'));
    } finally {
      setLoading(false);
    }
  }, [page, q]);

  useEffect(() => { void load(); }, [load]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearchParams(query.trim() ? { q: query.trim() } : {});
  };

  return (
    <AppShell
      variant="flow"
      title="Analysis history"
      navItems={getCitizenNav(user)}
      stepLabel="History"
      backTo={getAppBackFallback(false)}
    >
      <div className="ox-card list-panel list-panel--history">
        <div className="list-panel__toolbar">
          <span className="list-panel__label">All analyses</span>
          <Link to="/ai-analysis" className="list-panel__link">
            New identification
            <span className="material-symbols-outlined dash-icon-xs" aria-hidden>add</span>
          </Link>
        </div>

        <form className="history-search" onSubmit={onSearch}>
          <input
            className="ox-input"
            placeholder="Search by title or category…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search analyses"
          />
          <button type="submit" className="ox-btn ox-btn-secondary">Search</button>
        </form>

        {error && <ApiLoadBanner message={error} onRetry={() => void load()} />}

        <div className="list-panel__body">
          {loading ? (
            <DashHistorySkeleton />
          ) : items.length === 0 ? (
            <DashHistoryEmpty onStart={() => navigate('/ai-analysis')} />
          ) : (
            items.map((c) => {
              const level = c.aiResult?.courtWinOutlook?.level as CourtWinLevel | undefined;
              return (
                <div key={c.id} className="list-panel__row">
                  <Link to={`/analyses/${c.id}`} className="list-panel__row-main">
                    <div className="list-panel__thumb">
                      <span className="material-symbols-outlined">description</span>
                    </div>
                    <div className="list-panel__row-text">
                      <h4 className="list-panel__title">{consultationDisplayTitle(c)}</h4>
                      <div className="list-panel__meta-line">
                        {c.category ? <span className="list-panel__meta">{c.category}</span> : null}
                        {outlookPill(level)}
                      </div>
                    </div>
                  </Link>
                  <div className="list-panel__side list-panel__side--stacked">
                    <span className="list-panel__date">
                      {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <ConsultationRowActions
                      item={c}
                      onUpdated={load}
                      onDeleted={(id) => setItems((prev) => prev.filter((x) => x.id !== id))}
                      onOpen={(id) => navigate(`/analyses/${id}`)}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {totalPages > 1 && (
          <div className="history-pagination">
            <button
              type="button"
              className="ox-btn ox-btn-secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <span className="history-pagination__label">Page {page} of {totalPages}</span>
            <button
              type="button"
              className="ox-btn ox-btn-secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default AnalysisHistoryList;
