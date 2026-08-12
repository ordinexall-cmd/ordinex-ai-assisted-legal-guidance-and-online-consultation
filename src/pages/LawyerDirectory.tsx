import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/shell/AppShell';
import { lawyersApi, type LawyerCardSummary } from '../services/api';
import { getAppBackFallback } from '../utils/navigation';
import { LawyerDirectoryCard } from '../components/lawyer/LawyerDirectoryCard';
import { LawyerCardSkeleton } from '../components/dashboard/LawyerCardSkeleton';
import { getCitizenNav } from '../utils/citizenWorkspace';
import { getErrorMessage } from '../utils/userFacingError';
import {
  lawyerMatchesSpecialty,
  specialtyDisplayLabel,
} from '../constants/legalCategories';

function lawyerCountLabel(n: number): string {
  if (n === 0) return 'No matches';
  if (n === 1) return '1 lawyer';
  return `${n} lawyers`;
}

function sortBySpecialtyMatch(list: LawyerCardSummary[], specialty: string): LawyerCardSummary[] {
  return [...list].sort((a, b) => {
    const aMatch = lawyerMatchesSpecialty(a.specializations, specialty) ? 1 : 0;
    const bMatch = lawyerMatchesSpecialty(b.specializations, specialty) ? 1 : 0;
    if (bMatch !== aMatch) return bMatch - aMatch;
    if (Number(b.hasAvailability) !== Number(a.hasAvailability)) {
      return Number(b.hasAvailability) - Number(a.hasAvailability);
    }
    if ((b.openSlots || 0) !== (a.openSlots || 0)) return (b.openSlots || 0) - (a.openSlots || 0);
    if (b.rating !== a.rating) return b.rating - a.rating;
    const aFee = a.consultationFeeMin ?? a.consultationFee ?? Number.POSITIVE_INFINITY;
    const bFee = b.consultationFeeMin ?? b.consultationFee ?? Number.POSITIVE_INFINITY;
    return aFee - bFee;
  });
}

export const LawyerDirectory: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const specialtyFilter = (searchParams.get('specialty') || '').trim();
  const consultationId = (searchParams.get('consultationId') || '').trim() || undefined;

  const [search, setSearch] = useState('');
  const [lawyers, setLawyers] = useState<LawyerCardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isCaseMatch = Boolean(specialtyFilter);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      lawyersApi.list({
        search: search.trim() || undefined,
        practiceType: 'PRIVATE',
        specialty: specialtyFilter || undefined,
        limit: 24,
      })
        .then(({ lawyers: list }) => {
          const sorted = specialtyFilter ? sortBySpecialtyMatch(list, specialtyFilter) : list;
          setLawyers(sorted);
          setError('');
        })
        .catch((e: unknown) => setError(getErrorMessage(e, 'Failed to load lawyers.')))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [search, specialtyFilter]);

  const sectionTitle = isCaseMatch
    ? `Lawyers for ${specialtyDisplayLabel(specialtyFilter)}`
    : 'Verified private lawyers';

  const sectionSubtitle = isCaseMatch
    ? 'Matched to your AI case category.'
    : 'Book a video consultation with an independent licensed attorney.';

  return (
    <AppShell
      variant="flow"
      title="Legal Directory"
      navItems={getCitizenNav()}
      stepLabel="Directory"
      backTo={getAppBackFallback(false)}
    >
      <div className="staff-workspace marketplace">
        {isCaseMatch && (
          <div className="marketplace-banner">
            <p className="marketplace-banner__title">Matched to your case</p>
            <p className="marketplace-banner__body">
              Showing lawyers who handle {specialtyDisplayLabel(specialtyFilter)}.
              {consultationId ? ' Your analysis will be linked when you book.' : ''}
            </p>
            <button type="button" className="list-panel__link marketplace-banner__link" onClick={() => navigate('/lawyers')}>
              View all lawyers
            </button>
          </div>
        )}

        <div className="marketplace-search">
          <span className="material-symbols-outlined" aria-hidden>search</span>
          <input
            className="ox-input"
            placeholder="Search by name or specialty"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search lawyers"
          />
        </div>

        {!loading && !error && (
          <p className="marketplace-meta">{lawyerCountLabel(lawyers.length)}</p>
        )}

        <div className="staff-panel">
          {!loading && !error && lawyers.length > 0 && (
            <>
              <h2 className="staff-panel__title">{sectionTitle}</h2>
              <p className="staff-empty-hint" style={{ marginTop: '-0.5rem', marginBottom: '0.85rem' }}>
                {sectionSubtitle} Only Ordinex-verified private counsel appear here — confirm standing with IBP if you need extra assurance.
              </p>
            </>
          )}

          {loading ? (
            <LawyerCardSkeleton count={4} variant="tile" />
          ) : error ? (
            <div className="staff-alert staff-alert--error" role="alert">{error}</div>
          ) : lawyers.length === 0 ? (
            <div className="marketplace-empty">
              <span className="material-symbols-outlined marketplace-empty__icon" aria-hidden>search_off</span>
              <h3>
                {isCaseMatch
                  ? `No lawyers listed for ${specialtyDisplayLabel(specialtyFilter)} yet`
                  : 'No lawyers match your search'}
              </h3>
              <p>
                {isCaseMatch ? 'Try browsing all lawyers or adjusting your search.' : 'Try a different keyword.'}
              </p>
              {isCaseMatch && (
                <Link to="/lawyers" className="ox-btn ox-btn-primary" style={{ marginTop: 12 }}>
                  View all lawyers
                </Link>
              )}
            </div>
          ) : (
            <div className="marketplace-list">
              {lawyers.map((l) => {
                const matchBadge = isCaseMatch && lawyerMatchesSpecialty(l.specializations, specialtyFilter)
                  ? ('top' as const)
                  : null;
                return (
                  <LawyerDirectoryCard
                    key={l.id}
                    lawyer={l}
                    matchBadge={matchBadge}
                    consultationId={consultationId}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
};

export default LawyerDirectory;
