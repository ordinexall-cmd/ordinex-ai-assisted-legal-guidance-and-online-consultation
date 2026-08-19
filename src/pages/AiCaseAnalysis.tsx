import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/shell/AppShell';
import { useAuth } from '../context/AuthContext';
import {
  consultationApi,
  consultationDisplayTitle,
  ApiError,
  type ConsultationResult,
  type ConsultationOutcomeType,
  type ConsultationAnalysisMeta,
} from '../services/api';
import { ConsultationRowActions } from '../components/ConsultationRowActions';
import { getAppBackFallback } from '../utils/navigation';
import { DashHistorySkeleton } from '../components/dashboard/DashHistorySkeleton';
import { AnalysisPipelineSteps } from '../components/analysis/AnalysisPipelineSteps';
import { AnalysisSuggestedQuestions } from '../components/analysis/AnalysisSuggestedQuestions';
import { AnalysisResultsCitizen } from '../components/analysis/AnalysisResultsCitizen';
import { ApiLoadBanner } from '../components/ui/ApiLoadBanner';
import { getCitizenNav } from '../utils/citizenWorkspace';
import { loadErrorMessage } from '../utils/loadErrorMessage';
import { getErrorMessage } from '../utils/userFacingError';
import {
  CASE_ANALYSIS_CATEGORIES,
  buildLawyersPath,
  resolveMatchSpecialty,
} from '../constants/legalCategories';
import { clearGuestDraft, getGuestDraft } from '../constants/guestDraft';
import { SITUATION_PLACEHOLDER } from '../constants/situationPrompt';
import { assessDescriptionFacts } from '../utils/situationFacts';

const categories = CASE_ANALYSIS_CATEGORIES;

const PIPELINE_FINISH_MS = 400;
const MIN_DESCRIPTION_CHARS = 40;
const MAX_DESCRIPTION_CHARS = 2000;

export const AiCaseAnalysis: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Family');
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [pipelineFinishing, setPipelineFinishing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ConsultationResult | null>(null);
  const [history, setHistory] = useState<ConsultationResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyLoadError, setHistoryLoadError] = useState('');
  const [lastOutcomeType, setLastOutcomeType] = useState<ConsultationOutcomeType | null>(null);
  const [lastMeta, setLastMeta] = useState<ConsultationAnalysisMeta | null>(null);
  const [detailGaps, setDetailGaps] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const analyzeInFlight = useRef(false);

  const descLen = description.trim().length;
  const showPipeline = analyzing || pipelineFinishing;
  const isNeedsDetail = detailGaps.length > 0;
  const showResults = Boolean(result) && !showPipeline && !isNeedsDetail;

  const refreshHistory = () => {
    setHistoryLoading(true);
    setHistoryLoadError('');
    consultationApi.getHistory(1, 10)
      .then(({ consultations }) => setHistory(consultations))
      .catch((e) => {
        setHistory([]);
        setHistoryLoadError(loadErrorMessage(e, 'Could not load analysis history.'));
      })
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => { refreshHistory(); }, []);

  const runAnalysis = async (descText: string, catText: string, fileObj: File | null = null) => {
    const textLen = descText.trim().length;
    if (textLen < MIN_DESCRIPTION_CHARS) {
      setError(`Please describe your situation in at least ${MIN_DESCRIPTION_CHARS} characters (${textLen}/${MIN_DESCRIPTION_CHARS}).`);
      return;
    }
    if (textLen > MAX_DESCRIPTION_CHARS) {
      setError(`Please keep your description within ${MAX_DESCRIPTION_CHARS} characters.`);
      return;
    }
    const facts = assessDescriptionFacts(descText);
    if (!facts.ready) {
      setDetailGaps(facts.missing.map((m) => m.label));
      setResult(null);
      setLastOutcomeType('needs_detail');
      setError('');
      return;
    }
    if (analyzeInFlight.current) return;
    analyzeInFlight.current = true;
    setError('');
    setDetailGaps([]);
    setAnalyzing(true);
    setPipelineFinishing(false);
    setResult(null);
    setLastOutcomeType(null);

    try {
      const formData = new FormData();
      formData.append('category', catText);
      formData.append('description', descText);
      if (fileObj) formData.append('document', fileObj);

      const response = await consultationApi.analyze(formData);
      if (response.needsMoreDetail || !response.consultation) {
        setDetailGaps(response.missingFacts || facts.missing.map((m) => m.label));
        setResult(null);
        setLastOutcomeType('needs_detail');
        setLastMeta(response.meta ?? null);
        return;
      }
      setPipelineFinishing(true);
      await new Promise((r) => setTimeout(r, PIPELINE_FINISH_MS));
      setResult(response.consultation);
      setLastOutcomeType(response.meta?.outcomeType ?? 'full');
      setLastMeta(response.consultation.analysisMeta ?? response.meta ?? null);
      await refreshUser();
      setHistory((prev) => [response.consultation!, ...prev].slice(0, 10));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(getErrorMessage(err, 'Analysis failed. Please try again.'));
      }
    } finally {
      analyzeInFlight.current = false;
      setAnalyzing(false);
      setPipelineFinishing(false);
    }
  };

  useEffect(() => {
    const draft = getGuestDraft();
    if (draft?.description) {
      setDescription(draft.description);
      const targetCat = draft.category || category;
      if (draft.category) setCategory(draft.category);
      clearGuestDraft();
      if (
        draft.autoAnalyze
        && draft.description.trim().length >= MIN_DESCRIPTION_CHARS
        && draft.description.trim().length <= MAX_DESCRIPTION_CHARS
      ) {
        void runAnalysis(draft.description, targetCat, null);
      }
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) {
      consultationApi.getById(id)
        .then(({ consultation }) => {
          setResult(consultation);
          if (consultation.description) setDescription(consultation.description);
          if (consultation.category) setCategory(consultation.category);
        })
        .catch((e) => {
          setError(loadErrorMessage(e, 'Could not load the selected analysis.'));
          window.history.replaceState(null, '', '/ai-analysis');
        });
    }
  }, []);

  const handleAnalyze = async () => {
    await runAnalysis(description, category, file);
  };

  const loadConsultation = (c: ConsultationResult) => {
    setResult(c);
    if (c.description) setDescription(c.description);
    if (c.category) setCategory(c.category);
    const charged = c.trialsCharged !== false;
    const hasCases = (c.aiResult?.possibleLegalCases?.length ?? 0) > 0;
    setLastOutcomeType(charged && hasCases ? 'full' : 'needs_detail');
    setLastMeta(c.analysisMeta ?? null);
    window.history.replaceState(null, '', `/ai-analysis?id=${c.id}`);
  };

  const startNewAnalysis = () => {
    setResult(null);
    setDescription('');
    setFile(null);
    setLastOutcomeType(null);
    setLastMeta(null);
    setError('');
    setDetailGaps([]);
    window.history.replaceState(null, '', '/ai-analysis');
  };

  const appendSuggestion = (text: string) => {
    setDescription((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return text;
      if (trimmed.includes(text)) return prev;
      return `${trimmed}${trimmed.endsWith('.') || trimmed.endsWith('?') ? ' ' : '. '}${text}`;
    });
  };

  const ar = result?.aiResult;
  const missingFacts = ar?.courtWinOutlook.missingFacts;

  return (
    <AppShell
      variant="flow"
      title="AI Case Analysis"
      navItems={getCitizenNav(user)}
      stepLabel="Analysis"
      backTo={getAppBackFallback(false)}
    >
      <div className="analysis-describe">
        <div className="analysis-describe__layout">
          <div className="analysis-describe__col analysis-describe__col--form">
            <div className="analysis-describe__prompt">
              <h2>Describe your situation</h2>
              <p>A few clear facts help us match the right legal guidance.</p>
            </div>

            {isNeedsDetail && (
              <div
                className="callout-info"
                style={{
                  marginBottom: 16,
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: 10,
                  padding: '14px 18px',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#1d4ed8', marginTop: 2 }}>
                  info
                </span>
                <div style={{ flex: 1 }}>
                  <strong style={{ color: '#1e40af', fontSize: '0.95rem', display: 'block', marginBottom: 4 }}>
                    More detail needed for case matches
                  </strong>
                  <p style={{ margin: '0 0 8px', fontSize: '0.875rem', color: '#1e3a8a', lineHeight: 1.4 }}>
                    Add the missing facts below, then analyze again. We have not used an AI request yet.
                  </p>
                  <p style={{ margin: '0 0 6px', fontSize: '0.82rem', fontWeight: 600, color: '#1e40af' }}>
                    To get an accurate legal analysis, please include:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.82rem', color: '#1e3a8a', lineHeight: 1.6 }}>
                    {detailGaps.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="analysis-describe__compose">
              <textarea
                placeholder={SITUATION_PLACEHOLDER}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={showPipeline}
                maxLength={MAX_DESCRIPTION_CHARS}
                aria-describedby="desc-char-hint"
              />
              <p
                id="desc-char-hint"
                className={`analysis-describe__hint${descLen > 0 && descLen < MIN_DESCRIPTION_CHARS ? ' analysis-describe__hint--warn' : ''}`}
              >
                {descLen}/{MAX_DESCRIPTION_CHARS} characters
                {descLen > 0 && descLen < MIN_DESCRIPTION_CHARS ? ` — at least ${MIN_DESCRIPTION_CHARS} characters for a full analysis` : ''}
              </p>

              <label className="analysis-describe__category">
                <span className="analysis-describe__category-label">Legal category</span>
                <select
                  className="analysis-describe__select"
                  value={category}
                  disabled={showPipeline}
                  aria-label="Legal category"
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </label>

              {!showPipeline && !result && (
                <AnalysisSuggestedQuestions
                  category={category}
                  mode="starters"
                  onSelect={(text) => setDescription(text)}
                />
              )}

              {!showPipeline && isNeedsDetail && missingFacts && missingFacts.length > 0 && (
                <AnalysisSuggestedQuestions
                  category={category}
                  extraFacts={missingFacts}
                  className="analysis-suggested--inline"
                  onSelect={(text) => appendSuggestion(text)}
                />
              )}

              {!showPipeline && isNeedsDetail && (
                <>
                  <span className="analysis-describe__category-label" style={{ marginTop: 12 }}>Quick add details — tap to insert:</span>
                  <div className="analysis-describe__chips" role="group" aria-label="Quick fact helpers" style={{ marginBottom: 8 }}>
                    {[
                      { label: 'Date / Timeline', template: '[Petsa at Oras: ]' },
                      { label: 'Location', template: '[Lugar: ]' },
                      { label: 'Parties / Ages', template: '[Mga Sangkot at Edad: ]' },
                      { label: 'Documents / Actions', template: '[Mga Dokumento o Aksyon: ]' },
                    ].map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        className="analysis-describe__chip"
                        onClick={() => appendSuggestion(chip.template)}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {error && (
                <div className="callout-error" role="alert" style={{ marginTop: 12 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--color-ox-error)' }}>error</span>
                  <span className="callout-error__text">{error}</span>
                </div>
              )}

              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                tabIndex={-1}
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && f.size > 10 * 1024 * 1024) {
                    setError('Attachment must be 10 MB or smaller.');
                    e.target.value = '';
                    return;
                  }
                  setFile(f || null);
                  if (f) setError('');
                }}
              />

              <div className="analysis-describe__actions">
                <button
                  type="button"
                  className="ox-btn ox-btn-ghost"
                  onClick={() => fileRef.current?.click()}
                  disabled={showPipeline}
                  aria-label="Attach document"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>attach_file</span>
                  Attach
                </button>
                {file && (
                  <span className="analysis-describe__attach-chip">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>description</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{file.name}</span>
                    <button
                      type="button"
                      aria-label="Remove attachment"
                      onClick={() => {
                        setFile(null);
                        if (fileRef.current) fileRef.current.value = '';
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                    </button>
                  </span>
                )}
                <button
                  type="button"
                  className="ox-btn ox-btn-primary"
                  onClick={handleAnalyze}
                  disabled={showPipeline || descLen < MIN_DESCRIPTION_CHARS || descLen > MAX_DESCRIPTION_CHARS}
                >
                  {analyzing ? (
                    <>
                      <span className="spinner-14" aria-hidden />
                      Analyzing…
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>bolt</span>
                      Analyze
                    </>
                  )}
                </button>
              </div>

              {!showPipeline && (
                <div className="disclaimer-box analysis-describe__disclaimer" role="note">
                  <p>
                    Ordinex AI provides <strong>pre-guidance only</strong>. It does not replace advice
                    from a licensed attorney. For formal legal advice, book a verified lawyer.
                  </p>
                </div>
              )}
            </div>

            {!showPipeline && (
              <div className="analysis-describe__history">
                <div className="analysis-describe__history-head">
                  <h3>Recent</h3>
                  {history.length > 0 && (
                    <Link to="/analyses" className="list-panel__link">View all</Link>
                  )}
                </div>
                {historyLoadError && (
                  <ApiLoadBanner message={historyLoadError} onRetry={refreshHistory} />
                )}
                <div className="analysis-describe__history-list">
                  {historyLoading ? (
                    <DashHistorySkeleton />
                  ) : history.length === 0 ? (
                    <p className="analysis-describe__hint">No saved analyses yet.</p>
                  ) : (
                    history.slice(0, 5).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`analysis-describe__history-item${result?.id === c.id ? ' is-active' : ''}`}
                        onClick={() => loadConsultation(c)}
                      >
                        <span className="material-symbols-outlined" aria-hidden>description</span>
                        <span>{consultationDisplayTitle(c)}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="analysis-describe__col analysis-describe__col--result">
            {showPipeline && (
              <AnalysisPipelineSteps active={analyzing || pipelineFinishing} complete={pipelineFinishing} />
            )}

            {showResults && result && ar && (
              <>
                <div className="analysis-describe__toolbar" style={{ marginBottom: 12 }}>
                  <ConsultationRowActions
                    item={result}
                    onUpdated={refreshHistory}
                    onDeleted={(id) => {
                      setResult(null);
                      setLastOutcomeType(null);
                      setHistory((prev) => prev.filter((c) => c.id !== id));
                      window.history.replaceState(null, '', '/ai-analysis');
                    }}
                  />
                  <button type="button" className="ox-btn ox-btn-ghost" onClick={startNewAnalysis}>
                    New analysis
                  </button>
                </div>

                {lastOutcomeType && lastOutcomeType !== 'full' && (
                  <div className="callout-success" role="status" style={{ marginBottom: 12 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>info</span>
                    <span className="callout-success__text">
                      {lastOutcomeType === 'no_corpus'
                        ? 'Legal database unavailable — no trial was used. Try again later or add more detail.'
                        : 'More detail needed for case matches — no trial was used. Expand your description and analyze again.'}
                    </span>
                  </div>
                )}

                {(ar._supersededWarning || lastMeta?.supersededWarning) && (
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
                  <div className="complex-case-banner" role="alert" id="complex-case-warning">
                    <div className="complex-case-banner__icon">
                      <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#e6a817' }}>info</span>
                    </div>
                    <div className="complex-case-banner__body">
                      <p className="complex-case-banner__title">Need a professional opinion?</p>
                      <p className="complex-case-banner__text">
                        This situation may need specialized legal rules beyond our verified library.
                        Booking a short consultation with a licensed lawyer is recommended.
                      </p>
                      <Link
                        to={buildLawyersPath({
                          specialty: resolveMatchSpecialty({
                            category: result.category ?? category,
                            lawyerSpecialty: ar.lawyerSpecialty,
                            matchSpecialty: ar.matchSpecialty,
                          }),
                          consultationId: result.id,
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
                  meta={lastMeta ?? result.analysisMeta}
                  category={result.category ?? category}
                  consultationId={result.id}
                />
              </>
            )}

            {!showPipeline && !showResults && (
              <div className="analysis-describe__empty-result">
                <span className="material-symbols-outlined" aria-hidden>auto_awesome</span>
                <p>Results will appear here after you analyze.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default AiCaseAnalysis;
