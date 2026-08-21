import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/shell/AppShell';
import { useAuth } from '../context/AuthContext';
import {
  briefsApi,
  lawyersApi,
  type CitizenBrief,
  type LawyerCardSummary,
} from '../services/api';
import { getAppBackFallback } from '../utils/navigation';
import { LawyerDirectoryCard } from '../components/lawyer/LawyerDirectoryCard';
import { UserAvatar } from '../components/UserAvatar';
import { LawyerCardSkeleton } from '../components/dashboard/LawyerCardSkeleton';
import { getCitizenNav } from '../utils/citizenWorkspace';
import { getLawyerNav } from '../utils/lawyerWorkspace';
import { isCitizenBookingUnlocked } from '../utils/trustScore';
import { getErrorMessage } from '../utils/userFacingError';
import { VerificationGateNotice } from '../components/auth/VerificationGateNotice';
import { ApiLoadBanner } from '../components/ui/ApiLoadBanner';
import {
  lawyerMatchesSpecialty,
  specialtyDisplayLabel,
} from '../constants/legalCategories';
import { ConsultOfferForm } from '../components/briefs/ConsultOfferForm';
import {
  DirectoryFiltersPanel,
  type DirectoryFilters,
  type RateBand,
} from '../components/directory/DirectoryFiltersPanel';

const DEFAULT_FILTERS: DirectoryFilters = {
  category: '',
  rateBand: 'any',
  lawyerSort: 'relevance',
  briefSort: 'newest',
  availability: 'any',
};

function lawyerFee(l: LawyerCardSummary): number | null {
  const n = l.consultationFeeMin ?? l.consultationFee;
  return n == null ? null : n;
}

function briefBudget(b: CitizenBrief): number | null {
  if (b.budgetMin != null) return b.budgetMin;
  if (b.budgetMax != null) return b.budgetMax;
  return null;
}

function matchesRate(amount: number | null, band: RateBand, isFlexible: boolean): boolean {
  if (band === 'any') return true;
  if (band === 'flexible') return isFlexible;
  if (amount == null) return false;
  if (band === 'under-1000') return amount < 1000;
  if (band === '1000-3000') return amount >= 1000 && amount <= 3000;
  if (band === '3000-5000') return amount > 3000 && amount <= 5000;
  return amount > 5000;
}

function sortLawyers(
  list: LawyerCardSummary[],
  filters: DirectoryFilters,
): LawyerCardSummary[] {
  const specialty = filters.category;
  return [...list].sort((a, b) => {
    if (specialty) {
      const aMatch = lawyerMatchesSpecialty(a.specializations, specialty) ? 1 : 0;
      const bMatch = lawyerMatchesSpecialty(b.specializations, specialty) ? 1 : 0;
      if (bMatch !== aMatch) return bMatch - aMatch;
    }
    switch (filters.lawyerSort) {
      case 'rating':
        return b.rating - a.rating;
      case 'fee-low': {
        const aFee = lawyerFee(a) ?? Number.POSITIVE_INFINITY;
        const bFee = lawyerFee(b) ?? Number.POSITIVE_INFINITY;
        return aFee - bFee;
      }
      case 'fee-high':
        return (lawyerFee(b) ?? 0) - (lawyerFee(a) ?? 0);
      case 'experience':
        return (b.yearsOfExperience || 0) - (a.yearsOfExperience || 0);
      default: {
        if (Number(b.hasAvailability) !== Number(a.hasAvailability)) {
          return Number(b.hasAvailability) - Number(a.hasAvailability);
        }
        if ((b.openSlots || 0) !== (a.openSlots || 0)) return (b.openSlots || 0) - (a.openSlots || 0);
        if (b.rating !== a.rating) return b.rating - a.rating;
        return (lawyerFee(a) ?? Number.POSITIVE_INFINITY) - (lawyerFee(b) ?? Number.POSITIVE_INFINITY);
      }
    }
  });
}

function sortBriefs(list: CitizenBrief[], filters: DirectoryFilters): CitizenBrief[] {
  return [...list].sort((a, b) => {
    if (filters.briefSort === 'budget-low') {
      return (briefBudget(a) ?? Number.POSITIVE_INFINITY) - (briefBudget(b) ?? Number.POSITIVE_INFINITY);
    }
    if (filters.briefSort === 'budget-high') {
      return (briefBudget(b) ?? 0) - (briefBudget(a) ?? 0);
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function activeFilterCount(mode: 'lawyers' | 'briefs', filters: DirectoryFilters): number {
  let n = 0;
  if (filters.category) n += 1;
  if (filters.rateBand !== 'any') n += 1;
  if (mode === 'lawyers') {
    if (filters.availability === 'open') n += 1;
    if (filters.lawyerSort !== 'relevance') n += 1;
  } else if (filters.briefSort !== 'newest') {
    n += 1;
  }
  return n;
}

function lawyerCountLabel(n: number): string {
  if (n === 0) return 'No matches';
  if (n === 1) return '1 lawyer';
  return `${n} lawyers`;
}

function briefCountLabel(n: number): string {
  if (n === 0) return 'No matches';
  if (n === 1) return '1 request';
  return `${n} requests`;
}

function budgetLabel(b: CitizenBrief) {
  if (b.budgetMin == null && b.budgetMax == null) return 'Budget flexible';
  const min = b.budgetMin != null ? `₱${b.budgetMin.toLocaleString()}` : '';
  const max = b.budgetMax != null ? `₱${b.budgetMax.toLocaleString()}` : '';
  if (min && max && min !== max) return `${min}–${max}`;
  return min || max;
}

function placeLabel(b: CitizenBrief) {
  return [b.city, b.province].filter(Boolean).join(', ') || 'Philippines';
}

export function DirectorySearchRedirect() {
  const [params] = useSearchParams();
  const qs = params.toString();
  return <Navigate to={qs ? `/directory?${qs}` : '/directory'} replace />;
}

export const DirectoryPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isLawyer = user?.role === 'LAWYER';
  const mode = isLawyer ? 'briefs' : 'lawyers';
  const consultationId = (searchParams.get('consultationId') || '').trim() || undefined;
  const specialtyFromUrl = (searchParams.get('specialty') || '').trim();

  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<DirectoryFilters>({
    ...DEFAULT_FILTERS,
    category: specialtyFromUrl,
  });
  const [lawyers, setLawyers] = useState<LawyerCardSummary[]>([]);
  const [briefs, setBriefs] = useState<CitizenBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [offerId, setOfferId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const citizenLocked = !isLawyer && !isCitizenBookingUnlocked(user);
  const lawyerLocked = isLawyer && !user?.isVerified;
  const locked = citizenLocked || lawyerLocked;

  useEffect(() => {
    setFilters((prev) => (
      prev.category === specialtyFromUrl ? prev : { ...prev, category: specialtyFromUrl }
    ));
  }, [specialtyFromUrl]);

  const applyFilters = (next: DirectoryFilters) => {
    setFilters(next);
    const params = new URLSearchParams(searchParams);
    if (next.category) params.set('specialty', next.category);
    else params.delete('specialty');
    setSearchParams(params, { replace: true });
  };

  const loadLawyers = () => {
    setLoading(true);
    setError('');
    lawyersApi.list({
      search: search.trim() || undefined,
      practiceType: 'PRIVATE',
      specialty: filters.category || undefined,
      limit: 50,
    })
      .then(({ lawyers: list }) => setLawyers(list))
      .catch((e: unknown) => setError(getErrorMessage(e, 'Failed to load lawyers.')))
      .finally(() => setLoading(false));
  };

  const loadBriefs = () => {
    setLoading(true);
    setError('');
    briefsApi.listOpen({
      search: search.trim() || undefined,
      category: filters.category || undefined,
    })
      .then(({ briefs: list }) => setBriefs(list))
      .catch((e: unknown) => setError(getErrorMessage(e, 'Could not load open requests.')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (locked) {
      setLoading(false);
      return;
    }
    const t = setTimeout(() => {
      if (isLawyer) loadBriefs();
      else loadLawyers();
    }, 250);
    return () => clearTimeout(t);
  }, [search, filters.category, locked, isLawyer]);

  const filteredLawyers = useMemo(() => {
    const next = lawyers.filter((l) => {
      if (filters.availability === 'open' && !l.hasAvailability) return false;
      return matchesRate(lawyerFee(l), filters.rateBand, false);
    });
    return sortLawyers(next, filters);
  }, [lawyers, filters]);

  const filteredBriefs = useMemo(() => {
    const next = briefs.filter((b) => {
      const flexible = b.budgetMin == null && b.budgetMax == null;
      return matchesRate(briefBudget(b), filters.rateBand, flexible);
    });
    return sortBriefs(next, filters);
  }, [briefs, filters]);

  const sendOffer = async (payload: { message: string; durationMinutes: number; quotedFee?: number }) => {
    if (!offerId) return;
    setBusy(true);
    try {
      await briefsApi.offer(offerId, payload);
      setOfferId(null);
      setBriefs((prev) => prev.map((b) => (b.id === offerId ? { ...b, myOfferStatus: 'PENDING' } : b)));
    } catch (e) {
      setError(getErrorMessage(e, 'Could not send offer.'));
    } finally {
      setBusy(false);
    }
  };

  const navItems = isLawyer ? getLawyerNav(user) : getCitizenNav(user);
  const filterCount = activeFilterCount(mode, filters);
  const isCaseMatch = Boolean(filters.category) && !isLawyer;

  if (locked) {
    return (
      <AppShell
        variant="flow"
        title="Directory"
        navItems={navItems}
        stepLabel="Directory"
        backTo={getAppBackFallback(isLawyer)}
      >
        <VerificationGateNotice
          title="Profile verification required"
          featureName="Directory"
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      variant="flow"
      title="Directory"
      navItems={navItems}
      stepLabel="Directory"
      backTo={getAppBackFallback(isLawyer)}
    >
      <div className="staff-workspace marketplace marketplace--directory">
        {isCaseMatch && (
          <div className="marketplace-banner">
            <p className="marketplace-banner__title">Matched to your case</p>
            <p className="marketplace-banner__body">
              Showing lawyers who handle {specialtyDisplayLabel(filters.category)}.
              {consultationId ? ' Your case identification will be linked when you book.' : ''}
            </p>
            <button
              type="button"
              className="list-panel__link marketplace-banner__link"
              onClick={() => applyFilters({ ...filters, category: '' })}
            >
              View all lawyers
            </button>
          </div>
        )}

        <div className="marketplace-search marketplace-search--with-filters">
          <span className="material-symbols-outlined" aria-hidden>search</span>
          <input
            className="ox-input"
            placeholder={isLawyer ? 'Search by city or need' : 'Search by name, specialty, or location'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={isLawyer ? 'Search open requests' : 'Search lawyers'}
          />
          <button
            type="button"
            className={`marketplace-search__filters${filterCount > 0 ? ' is-active' : ''}`}
            aria-expanded={filtersOpen}
            aria-haspopup="dialog"
            onClick={() => setFiltersOpen(true)}
          >
            <span className="material-symbols-outlined" aria-hidden>tune</span>
            Filters
            {filterCount > 0 ? <span className="marketplace-search__badge">{filterCount}</span> : null}
          </button>
        </div>

        <DirectoryFiltersPanel
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          mode={mode}
          filters={filters}
          onChange={applyFilters}
        />

        {error && (
          isLawyer
            ? <ApiLoadBanner message={error} onRetry={loadBriefs} />
            : <div className="staff-alert staff-alert--error" role="alert">{error}</div>
        )}

        {!loading && !error && (
          <p className="marketplace-meta">
            {isLawyer ? briefCountLabel(filteredBriefs.length) : lawyerCountLabel(filteredLawyers.length)}
          </p>
        )}

        {loading ? (
          <LawyerCardSkeleton
            count={8}
            variant="portrait"
            label={isLawyer ? 'Loading open requests' : 'Loading lawyers'}
          />
        ) : isLawyer ? (
          filteredBriefs.length === 0 ? (
            <p className="staff-empty-hint">No open requests match these filters.</p>
          ) : (
            <>
              <div className="dir-lawyer-grid">
                {filteredBriefs.map((b) => (
                  <article key={b.id} className="dir-lawyer-card">
                    <div
                      className="dir-lawyer-card__body"
                      style={{ cursor: 'pointer' }}
                      role="link"
                      tabIndex={0}
                      onClick={() => navigate(`/directory/requests/${b.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(`/directory/requests/${b.id}`);
                        }
                      }}
                    >
                      <div className="dir-lawyer-card__avatar" aria-hidden>
                        <UserAvatar name={b.displayName} size="lg" />
                      </div>
                      <h3 className="dir-lawyer-card__name">{b.displayName}</h3>
                      <p className="dir-lawyer-card__loc">{placeLabel(b)}</p>
                      <span className="dir-lawyer-card__spec">{specialtyDisplayLabel(b.category)}</span>
                      <p className="dir-lawyer-card__loc" style={{ marginTop: 8 }}>{b.summary}</p>
                      {(b.hasLinkedAnalysis || b.consultationId) && (
                        <p className="dir-lawyer-card__loc" style={{ marginTop: 6 }}>
                          Linked case identification{b.analysisTitle ? `: ${b.analysisTitle}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="dir-lawyer-card__footer">
                      <span className="dir-lawyer-card__avail">{budgetLabel(b)}</span>
                      {b.myOfferStatus ? (
                        <span className="dir-lawyer-card__avail">Offer sent</span>
                      ) : (
                        <button
                          type="button"
                          className="ox-btn ox-btn-primary ox-btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOfferId(b.id);
                          }}
                        >
                          Offer consult
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              {offerId && (
                <div className="acct-section" style={{ marginTop: '1rem' }}>
                  <div className="acct-section__head">
                    <h2 className="acct-section__title">Offer consult</h2>
                    <button type="button" className="list-panel__link" onClick={() => { setOfferId(null); setError(''); }}>Cancel</button>
                  </div>
                  <div className="acct-section__body" style={{ padding: '0.85rem 1rem' }}>
                    <ConsultOfferForm
                      feeMin={user?.consultationFeeMin ?? user?.consultationFee ?? 0}
                      feeMax={user?.consultationFeeMax ?? user?.consultationFeeMin ?? user?.consultationFee ?? 0}
                      busy={busy}
                      error={error}
                      onCancel={() => { setOfferId(null); setError(''); }}
                      onSubmit={(payload) => { void sendOffer(payload); }}
                    />
                  </div>
                </div>
              )}
            </>
          )
        ) : filteredLawyers.length === 0 ? (
          <div className="marketplace-empty">
            <span className="material-symbols-outlined marketplace-empty__icon" aria-hidden>search_off</span>
            <h3>
              {isCaseMatch
                ? `No lawyers listed for ${specialtyDisplayLabel(filters.category)} yet`
                : 'No available lawyers match these filters.'}
            </h3>
            <p>
              {isCaseMatch ? 'Try browsing all lawyers or adjusting your search.' : 'Try a different keyword or filter.'}
            </p>
            {isCaseMatch && (
              <button
                type="button"
                className="ox-btn ox-btn-primary"
                style={{ marginTop: 12 }}
                onClick={() => applyFilters({ ...filters, category: '' })}
              >
                View all lawyers
              </button>
            )}
          </div>
        ) : (
          <div className="dir-lawyer-grid">
            {filteredLawyers.map((l) => {
              const matchBadge = isCaseMatch && lawyerMatchesSpecialty(l.specializations, filters.category)
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
    </AppShell>
  );
};

export default DirectoryPage;
