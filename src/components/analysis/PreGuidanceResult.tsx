import React, { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LegalAnalysisResult } from '../../services/api';
import { buildLawyersPath, resolveMatchSpecialty } from '../../constants/legalCategories';

export const CASE_MATCH_MIN = 50;

export function visibleLegalCases(ar: LegalAnalysisResult) {
  return (ar.possibleLegalCases || [])
    .filter((c) => Number(c.confidenceScore) >= CASE_MATCH_MIN)
    .slice(0, 3);
}

function sameText(a?: string, b?: string) {
  return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
}

export interface PreGuidanceResultProps {
  readonly ar: LegalAnalysisResult;
  readonly category?: string;
  readonly consultationId?: string;
  readonly isLawyerView?: boolean;
  readonly variant?: 'citizen' | 'landing';
  readonly toolbar?: ReactNode;
  readonly extra?: ReactNode;
  readonly onConsultLawyer?: () => void;
  readonly onAnalyzeAnother?: () => void;
}

export const PreGuidanceResult: React.FC<PreGuidanceResultProps> = ({
  ar,
  category,
  consultationId,
  isLawyerView = false,
  variant = 'citizen',
  toolbar,
  extra,
  onConsultLawyer,
  onAnalyzeAnother,
}) => {
  const topCases = visibleLegalCases(ar);
  const factorsFor = ar.courtWinOutlook?.factorsFor?.slice(0, 3) ?? [];
  const factorsAgainst = ar.courtWinOutlook?.factorsAgainst?.slice(0, 3) ?? [];
  const missingFacts = ar.courtWinOutlook?.missingFacts ?? [];
  const situationSummary = ar.courtWinOutlook?.summary || '';
  const showSituationText = Boolean(situationSummary) && !sameText(situationSummary, ar.userConcernSummary);
  const showSituation = showSituationText || factorsFor.length > 0 || factorsAgainst.length > 0;
  const librarySteps = ar.libraryNextSteps?.filter((s) => s.trim()) ?? [];
  const possibleSteps = ar.possibleNextSteps?.filter((s) => s.trim()) ?? [];
  const libraryDocs = ar.libraryDocuments?.filter((s) => s.trim()) ?? [];
  const possibleDocs = ar.possibleDocuments?.filter((s) => s.trim()) ?? [];
  const libraryCautions = ar.libraryCautions?.filter((s) => s.trim()) ?? [];
  const cautions = (ar.cautions || []).filter((c) => c.trim());
  const nextSteps = librarySteps.length ? librarySteps : (ar.suggestedNextSteps || []);
  const deadline = ar.possibleDeadline?.trim() || '';
  const lawyersPath = buildLawyersPath({
    specialty: resolveMatchSpecialty({
      category,
      lawyerSpecialty: ar.lawyerSpecialty,
      matchSpecialty: ar.matchSpecialty,
    }),
    consultationId,
  });

  return (
    <div className={`analysis-result-card${variant === 'landing' ? ' analysis-result-card--embedded' : ''}`}>
      <header className="analysis-result-card__head">
        <div className="analysis-result-card__head-text">
          <span className="analysis-result-card__badge">
            {variant === 'landing' ? 'Case identification' : 'Case identification'}
          </span>
          <h2 className="analysis-result-card__title">What we found</h2>
        </div>
      </header>

      {toolbar}

      <div className="analysis-result-card__body">
        <p className="analysis-result-card__summary">{ar.userConcernSummary}</p>

        {topCases.length > 0 && (
          <section className="analysis-result-card__section">
            <h3 className="analysis-result-card__sec-title">Possible legal issues</h3>
            <div className="analysis-result-card__cases">
              {topCases.map((c) => (
                <article key={c.name} className="analysis-result-card__case">
                  <h4>{c.name.split('(')[0].trim()}</h4>
                  <p className="analysis-result-card__case-meta">
                    Match confidence: {Math.round(c.confidenceScore)}%
                  </p>
                  <p>{c.explanation}</p>
                  {c.applicableLaw && (
                    <p className="analysis-result-card__case-law">
                      <span className="analysis-result-card__cite">{c.applicableLaw}</span>
                    </p>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {showSituation && (
          <section className="analysis-result-card__section">
            <h3 className="analysis-result-card__sec-title">
              {isLawyerView ? "Client's situation" : 'Your situation'}
            </h3>
            {showSituationText ? <p>{situationSummary}</p> : null}
            {(factorsFor.length > 0 || factorsAgainst.length > 0) && (
              <ul className="analysis-result-card__list">
                {factorsFor.map((f) => (
                  <li key={`for-${f}`}>
                    <span className="analysis-result-card__tag analysis-result-card__tag--for">Helps</span>
                    {f}
                  </li>
                ))}
                {factorsAgainst.map((f) => (
                  <li key={`against-${f}`}>
                    <span className="analysis-result-card__tag analysis-result-card__tag--against">Hurts</span>
                    {f}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="analysis-result-card__section">
          <h3 className="analysis-result-card__sec-title">What to do next</h3>
          {nextSteps.length ? (
            <ol className="analysis-result-card__list analysis-result-card__list--numbered">
              {nextSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          ) : (
            <p>A licensed lawyer can confirm the next filing or demand steps for your facts.</p>
          )}
          {possibleSteps.length > 0 && (
            <div className="analysis-result-card__docs">
              <h4 className="analysis-result-card__sub-title">Possible next steps</h4>
              <ul className="analysis-result-card__list">
                {possibleSteps.map((step) => (
                  <li key={`p-${step}`}>{step}</li>
                ))}
              </ul>
            </div>
          )}
          {libraryDocs.length > 0 && (
            <div className="analysis-result-card__docs">
              <h4 className="analysis-result-card__sub-title">Documents</h4>
              <ul className="analysis-result-card__list analysis-result-card__list--checklist">
                {libraryDocs.map((fact) => (
                  <li key={fact}>{fact}</li>
                ))}
              </ul>
            </div>
          )}
          {possibleDocs.length > 0 && (
            <div className="analysis-result-card__docs">
              <h4 className="analysis-result-card__sub-title">Possible documents needed</h4>
              <ul className="analysis-result-card__list analysis-result-card__list--checklist">
                {possibleDocs.map((fact) => (
                  <li key={`pd-${fact}`}>{fact}</li>
                ))}
              </ul>
            </div>
          )}
          {libraryDocs.length === 0 && possibleDocs.length === 0 && missingFacts.length > 0 && (
            <div className="analysis-result-card__docs">
              <h4 className="analysis-result-card__sub-title">Possible documents needed</h4>
              <ul className="analysis-result-card__list analysis-result-card__list--checklist">
                {missingFacts.map((fact) => (
                  <li key={fact}>{fact}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {ar.penalties?.trim() ? (
          <section className="analysis-result-card__section">
            <h3 className="analysis-result-card__sec-title">Possible exposure</h3>
            <p>{ar.penalties}</p>
          </section>
        ) : null}

        {deadline ? (
          <section className="analysis-result-card__section">
            <h3 className="analysis-result-card__sec-title">Is there a time limit?</h3>
            <p>{deadline}</p>
          </section>
        ) : null}

        {libraryCautions.length > 0 || cautions.length > 0 ? (
          <section className="analysis-result-card__section">
            <h3 className="analysis-result-card__sec-title">What not to do yet</h3>
            <ul className="analysis-result-card__list">
              {(libraryCautions.length ? libraryCautions : cautions).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {(ar.recommendedAgency || ar.lawyerSpecialty || ar.costBallpark) && (
          <section className="analysis-result-card__section">
            <h3 className="analysis-result-card__sec-title">Where to go</h3>
            <p>
              {ar.recommendedAgency && <>Agency: {ar.recommendedAgency}. </>}
              {ar.lawyerSpecialty && <>Lawyer type: {ar.lawyerSpecialty}. </>}
              {ar.costBallpark && <>Costs: {ar.costBallpark}</>}
            </p>
          </section>
        )}
      </div>

      {variant === 'citizen' && !isLawyerView && (
        <div className="analysis-result-card__cta">
          <Link to={lawyersPath} className="analysis-result-card__cta-btn">
            <span className="material-symbols-outlined" aria-hidden>gavel</span>
            {' '}Consult a verified lawyer
          </Link>
        </div>
      )}

      {variant === 'landing' && (
        <div className="analysis-result-card__cta analysis-result-card__cta--split">
          <button type="button" className="analysis-result-card__cta-btn" onClick={onConsultLawyer}>
            <span className="material-symbols-outlined" aria-hidden>gavel</span>
            Consult a lawyer for confirmation
          </button>
          <button type="button" className="ox-btn ox-btn-outline" onClick={onAnalyzeAnother}>
            Identify another situation
          </button>
        </div>
      )}

      {extra}

      <p className="analysis-result-card__disclaimer analysis-result-card__disclaimer--always">
        {ar.systemDisclaimer}
      </p>
    </div>
  );
};

export default PreGuidanceResult;
