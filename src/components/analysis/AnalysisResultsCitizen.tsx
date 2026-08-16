import React from 'react';
import {
  type ConsultationAnalysisMeta,
  type LegalAnalysisResult,
} from '../../services/api';
import { AnalysisGroundingCard } from './AnalysisGroundingCard';
import { PreGuidanceResult } from './PreGuidanceResult';

interface AnalysisResultsCitizenProps {
  readonly ar: LegalAnalysisResult;
  readonly meta?: ConsultationAnalysisMeta | null;
  readonly category?: string;
  readonly consultationId?: string;
  readonly defaultShowDetails?: boolean;
  readonly isLawyerView?: boolean;
}

export const AnalysisResultsCitizen: React.FC<AnalysisResultsCitizenProps> = ({
  ar,
  meta,
  category,
  consultationId,
  defaultShowDetails = false,
  isLawyerView = false,
}) => {
  const extra = (
    <details className="analysis-result-card__details" open={defaultShowDetails}>
      <summary>Sources &amp; details</summary>
      <div className="analysis-result-card__details-body">
        <AnalysisGroundingCard meta={meta} />
        {(ar.possibleLegalCases || []).length > 0 && (
          <ul className="analysis-result-card__list">
            {ar.possibleLegalCases.map((c) => (
              <li key={c.name}>
                <strong>{c.name}</strong>
                {` — Confidence ${Math.round(c.confidenceScore)}%`}
                {c.applicableLaw ? ` · ${c.applicableLaw}` : ''}
                {c.sourceLink ? (
                  <>
                    {' · '}
                    <a href={c.sourceLink} target="_blank" rel="noreferrer">Citation</a>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );

  return (
    <PreGuidanceResult
      ar={ar}
      category={category}
      consultationId={consultationId}
      isLawyerView={isLawyerView}
      variant="citizen"
      extra={extra}
    />
  );
};

export default AnalysisResultsCitizen;
