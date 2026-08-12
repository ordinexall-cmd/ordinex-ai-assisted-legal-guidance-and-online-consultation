import React from 'react';
import type { ConsultationAnalysisMeta } from '../../services/api';

interface AnalysisGroundingCardProps {
  readonly meta: ConsultationAnalysisMeta | null | undefined;
}

function sourceLabel(source: string | undefined): string {
  switch (source) {
    case 'supabase-vector':
      return 'Curated database (semantic search)';
    case 'supabase':
      return 'Curated database (keyword match)';
    case 'prisma':
      return 'Local law references';
    case 'local':
      return 'Bundled legal corpus';
    default:
      return source || 'Unknown source';
  }
}

export const AnalysisGroundingCard: React.FC<AnalysisGroundingCardProps> = ({ meta }) => {
  if (!meta) return null;

  const freshness = meta.corpusFreshness;
  const health = meta.corpusHealth;

  return (
    <div className="analysis-grounding-card" role="status" aria-label="Legal grounding summary">
      <div className="analysis-grounding-card__head">
        <span className="material-symbols-outlined" aria-hidden>fact_check</span>
        <h3 className="analysis-grounding-card__title">Legal grounding</h3>
      </div>
      <p className="analysis-grounding-card__source">
        Sources: <strong>{sourceLabel(meta.corpusSource)}</strong>
      </p>
      {freshness && freshness.total > 0 && (
        <p className="analysis-grounding-card__stats">
          {freshness.total} reference{freshness.total === 1 ? '' : 's'} used
          {freshness.highPriority > 0 && ` · ${freshness.highPriority} high-priority curated`}
          {freshness.amended > 0 && ` · ${freshness.amended} recently amended`}
          {freshness.superseded > 0 && ` · ${freshness.superseded} superseded (excluded from match)`}
          {typeof freshness.oldestDays === 'number' && freshness.oldestDays > 0
            && ` · oldest update ${freshness.oldestDays}d ago`}
        </p>
      )}
      {meta.supersededWarning && (
        <p className="analysis-grounding-card__warn">
          Some matched references may be outdated. Confirm with a licensed lawyer before acting.
        </p>
      )}
      {health && !health.meetsMinimum && (
        <p className="analysis-grounding-card__warn">
          Curated library is below the 200-entry target — confidence may be lower until the corpus is fully seeded.
        </p>
      )}
    </div>
  );
};

export default AnalysisGroundingCard;
