import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { LawyerCardSummary } from '../../services/api';
import { appendConsultationIdToPath, buildLawyerBookPath } from '../../constants/legalCategories';
import { LawyerPracticeBadge } from './LawyerPracticeBadge';

const peso = (n: number | null) => (n == null ? 'Ask' : n === 0 ? 'Free' : `₱${n.toLocaleString()}`);

function lawyerFeeLabel(l: LawyerCardSummary): string {
  const min = l.consultationFeeMin ?? l.consultationFee;
  const max = l.consultationFeeMax ?? min;
  if (min == null) return 'Ask';
  if (max != null && max !== min) return `₱${min.toLocaleString()}–₱${max.toLocaleString()}`;
  return peso(min);
}

export interface LawyerDirectoryCardProps {
  readonly lawyer: LawyerCardSummary;
  readonly matchBadge?: 'top' | 'good' | null;
  readonly consultationId?: string;
}

export const LawyerDirectoryCard: React.FC<LawyerDirectoryCardProps> = ({
  lawyer: l,
  matchBadge,
  consultationId,
}) => {
  const navigate = useNavigate();
  const profilePath = appendConsultationIdToPath(`/lawyers/${l.id}`, consultationId);
  const bookPath = buildLawyerBookPath(l.id, consultationId);

  return (
    <article className={`marketplace-lawyer-row${l.hasAvailability ? '' : ' marketplace-lawyer-row--muted'}`}>
      <div className="marketplace-lawyer-row__avatar">
        {l.avatarUrl ? (
          <img src={l.avatarUrl} alt="" />
        ) : (
          <span className="marketplace-lawyer-row__initials" aria-hidden>
            {(l.name || '?').slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>

      <div className="marketplace-lawyer-row__main">
        <div className="marketplace-lawyer-row__name-row">
          <h3 className="marketplace-lawyer-row__name">{l.name}</h3>
          {l.isVerified && (
            <span
              className="marketplace-lawyer-row__verified-text"
              title="Ordinex verified counsel — roll check + ID KYC. You may still confirm with IBP yourself."
            >
              Verified counsel
            </span>
          )}
          {matchBadge ? (
            <span className="marketplace-lawyer-row__match">
              {matchBadge === 'top' ? 'Top match' : 'Good match'}
            </span>
          ) : null}
          <LawyerPracticeBadge practiceType={l.practiceType} />
        </div>
        <p className="marketplace-lawyer-row__spec">
          {l.specializations.slice(0, 3).join(' · ') || 'General practice'}
        </p>
        <div className="marketplace-lawyer-row__meta">
          <span>Fee: <strong className="marketplace-lawyer-row__fee">{lawyerFeeLabel(l)}</strong></span>
          <span>Open slots: <strong>{l.hasAvailability ? l.openSlots : 'None'}</strong></span>
          {l.ratingCount > 0 && (
            <span>
              Rating <strong>{l.rating.toFixed(1)}</strong> ({l.ratingCount})
            </span>
          )}
        </div>
      </div>

      <div className="marketplace-lawyer-row__actions">
        <button
          type="button"
          className="ox-btn ox-btn-primary ox-btn-sm"
          onClick={() => navigate(bookPath)}
          disabled={!l.hasAvailability}
          title={l.hasAvailability ? undefined : 'No open slots'}
        >
          Book
        </button>
        <button
          type="button"
          className="ox-btn ox-btn-ghost ox-btn-sm"
          onClick={() => navigate(profilePath)}
        >
          Profile
        </button>
      </div>
    </article>
  );
};

export default LawyerDirectoryCard;
