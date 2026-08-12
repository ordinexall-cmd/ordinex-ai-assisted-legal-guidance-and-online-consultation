import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  consultationApi,
  type ConsultationAnalysisMeta,
  type LegalAnalysisResult,
} from '../../services/api';
import { AnalysisGroundingCard } from './AnalysisGroundingCard';
import { outlookPill } from '../dashboard/outlookPill';
import { buildLawyersPath, resolveMatchSpecialty } from '../../constants/legalCategories';
import { getErrorMessage } from '../../utils/userFacingError';

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
  const [display, setDisplay] = useState(ar);
  const [languages, setLanguages] = useState<{ code: string; name: string }[]>([]);
  const [translateAvailable, setTranslateAvailable] = useState(false);
  const [targetLang, setTargetLang] = useState('en');
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState('');
  const [activeLang, setActiveLang] = useState<string | null>(null);

  useEffect(() => {
    setDisplay(ar);
    setActiveLang(null);
    setTranslateError('');
  }, [ar]);

  useEffect(() => {
    if (!consultationId || isLawyerView) return;
    let cancelled = false;
    consultationApi
      .translateLanguages()
      .then((res) => {
        if (cancelled) return;
        setLanguages(res.languages || []);
        setTranslateAvailable(Boolean(res.available));
      })
      .catch(() => {
        if (!cancelled) setTranslateAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [consultationId, isLawyerView]);

  const outlookEl = outlookPill(display.courtWinOutlook.level);
  const topCases = display.possibleLegalCases.slice(0, 3);
  const factorsFor = display.courtWinOutlook.factorsFor.slice(0, 3);
  const factorsAgainst = display.courtWinOutlook.factorsAgainst.slice(0, 3);

  const lawyersPath = useMemo(
    () => buildLawyersPath({
      specialty: resolveMatchSpecialty({
        category,
        lawyerSpecialty: ar.lawyerSpecialty,
        matchSpecialty: ar.matchSpecialty,
      }),
      consultationId,
    }),
    [ar.lawyerSpecialty, ar.matchSpecialty, category, consultationId],
  );

  const onTranslate = async () => {
    if (!consultationId) return;
    setTranslating(true);
    setTranslateError('');
    try {
      const { translated, targetLang: lang } = await consultationApi.translate(
        consultationId,
        targetLang,
      );
      setDisplay({
        ...ar,
        userConcernSummary: translated.userConcernSummary || ar.userConcernSummary,
        penalties: translated.penalties || ar.penalties,
        courtWinOutlook: {
          ...ar.courtWinOutlook,
          summary: translated.courtWinOutlookSummary || ar.courtWinOutlook.summary,
        },
        suggestedNextSteps: translated.suggestedNextSteps?.length
          ? translated.suggestedNextSteps
          : ar.suggestedNextSteps,
        possibleLegalCases: (ar.possibleLegalCases || []).map((c, i) => ({
          ...c,
          explanation: translated.possibleLegalCases?.[i]?.explanation || c.explanation,
        })),
      });
      setActiveLang(lang);
    } catch (e: unknown) {
      setTranslateError(getErrorMessage(e, 'Translation failed.'));
    } finally {
      setTranslating(false);
    }
  };

  const resetOriginal = () => {
    setDisplay(ar);
    setActiveLang(null);
    setTranslateError('');
  };

  return (
    <div className="analysis-result-card">
      <header className="analysis-result-card__head">
        <div className="analysis-result-card__head-text">
          <span className="analysis-result-card__badge">Pre-guidance</span>
          <h2 className="analysis-result-card__title">What we found</h2>
        </div>
        <span>{outlookEl}</span>
      </header>

      {!isLawyerView && consultationId && translateAvailable && languages.length > 0 && (
        <div className="analysis-translate-toolbar">
          <label className="analysis-translate-toolbar__label">
            Read in
            <select
              className="ox-input analysis-translate-toolbar__select"
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              aria-label="Translation language"
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>{l.name}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="ox-btn ox-btn-sm"
            disabled={translating}
            onClick={() => { void onTranslate(); }}
          >
            {translating ? 'Translating…' : 'Translate'}
          </button>
          {activeLang && (
            <button type="button" className="link-inline" onClick={resetOriginal}>
              Show original
            </button>
          )}
          {translateError && (
            <span className="analysis-translate-toolbar__error" role="alert">{translateError}</span>
          )}
        </div>
      )}

      <div className="analysis-result-card__body">
      <p className="analysis-result-card__summary">{display.userConcernSummary}</p>

      <section className="analysis-result-card__section">
        <h3 className="analysis-result-card__sec-title">
          {isLawyerView ? "Client's situation" : 'Your situation'}
        </h3>
        <p>{display.courtWinOutlook.summary}</p>
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

      <section className="analysis-result-card__section">
        <h3 className="analysis-result-card__sec-title">What to do next</h3>
        <ol className="analysis-result-card__list analysis-result-card__list--numbered">
          {display.suggestedNextSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      {display.penalties?.trim() && (
        <section className="analysis-result-card__section">
          <h3 className="analysis-result-card__sec-title">Possible penalties</h3>
          <p>{display.penalties}</p>
        </section>
      )}

      {topCases.length > 0 && (
        <section className="analysis-result-card__section">
          <h3 className="analysis-result-card__sec-title">Possible cases</h3>
          <div className="analysis-result-card__cases">
            {topCases.map((c) => (
              <article key={c.name} className="analysis-result-card__case">
                <h4>{c.name.split('(')[0].trim()}</h4>
                <p className="analysis-result-card__case-meta">Match confidence: {Math.round(c.confidenceScore)}%</p>
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

      {(display.recommendedAgency || display.lawyerSpecialty || display.costBallpark) && (
        <section className="analysis-result-card__section">
          <h3 className="analysis-result-card__sec-title">Quick notes</h3>
          <p>
            {display.recommendedAgency && <>Agency: {display.recommendedAgency}. </>}
            {display.lawyerSpecialty && <>Lawyer type: {display.lawyerSpecialty}. </>}
            {display.costBallpark && <>Costs: {display.costBallpark}</>}
          </p>
        </section>
      )}
      </div>

      {!isLawyerView && (
        <div className="analysis-result-card__cta">
          <Link to={lawyersPath} className="analysis-result-card__cta-btn">
            Find a lawyer
          </Link>
        </div>
      )}

      <details className="analysis-result-card__details" open={defaultShowDetails}>
        <summary>Sources &amp; details</summary>
        <div className="analysis-result-card__details-body">
          <AnalysisGroundingCard meta={meta} />
          {display.possibleLegalCases.length > 0 && (
            <ul className="analysis-result-card__list">
              {display.possibleLegalCases.map((c) => (
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
          <p className="analysis-result-card__disclaimer">{display.systemDisclaimer}</p>
        </div>
      </details>
    </div>
  );
};

export default AnalysisResultsCitizen;
