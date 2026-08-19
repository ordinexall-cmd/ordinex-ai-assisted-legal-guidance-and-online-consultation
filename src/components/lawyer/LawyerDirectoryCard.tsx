import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserAvatar } from '../UserAvatar';
import type { LawyerCardSummary } from '../../services/api';
import { appendConsultationIdToPath, buildLawyerBookPath, specialtyDisplayLabel } from '../../constants/legalCategories';

function lawyerLocation(l: LawyerCardSummary): string {
  const parts = [l.city, l.province].filter(Boolean);
  return parts.length ? parts.join(', ') : 'Philippines';
}

function feeLabel(l: LawyerCardSummary): string | null {
  const min = l.consultationFeeMin ?? l.consultationFee;
  const max = l.consultationFeeMax;
  if (min == null && max == null) return null;
  if (min != null && max != null && min !== max) {
    return `₱${min.toLocaleString()}–₱${max.toLocaleString()}`;
  }
  const n = min ?? max;
  return n == null ? null : `₱${n.toLocaleString()}`;
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
  const fee = feeLabel(l);
  const primarySpec = l.specializations[0]
    ? specialtyDisplayLabel(l.specializations[0])
    : 'General practice';

  return (
    <article className={`dir-lawyer-card${l.hasAvailability ? '' : ' dir-lawyer-card--muted'}`}>
      {l.ratingCount > 0 && (
        <span className="dir-lawyer-card__rating">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden>star</span>
          {l.rating.toFixed(1)}
        </span>
      )}
      {matchBadge ? (
        <span className="dir-lawyer-card__match">{matchBadge === 'top' ? 'Top match' : 'Good match'}</span>
      ) : null}

      <button
        type="button"
        className="dir-lawyer-card__body"
        onClick={() => navigate(profilePath)}
      >
        <div className="dir-lawyer-card__avatar">
          <UserAvatar avatarUrl={l.avatarUrl} name={l.name} size="lg" />
        </div>
        <h3 className="dir-lawyer-card__name">
          {l.name}
          <span className="material-symbols-outlined dir-lawyer-card__check" title="Verified counsel">verified</span>
        </h3>
        <p className="dir-lawyer-card__loc">{lawyerLocation(l)}</p>
        <span className="dir-lawyer-card__spec">{primarySpec}</span>
        {fee ? <p className="dir-lawyer-card__fee">{fee}</p> : null}
      </button>

      <div className="dir-lawyer-card__footer">
        <span className="dir-lawyer-card__avail">
          <span className="material-symbols-outlined" aria-hidden>calendar_month</span>
          {l.hasAvailability ? `${l.openSlots} open` : 'No slots'}
        </span>
        <button
          type="button"
          className="ox-btn ox-btn-primary ox-btn-sm"
          onClick={() => navigate(bookPath)}
          disabled={!l.hasAvailability}
          title={l.hasAvailability ? undefined : 'No open slots'}
        >
          Book
        </button>
      </div>
    </article>
  );
};

export default LawyerDirectoryCard;
