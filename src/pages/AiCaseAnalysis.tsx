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

const categories = CASE_ANALYSIS_CATEGORIES;

const PIPELINE_FINISH_MS = 400;
const MIN_DESCRIPTION_CHARS = 40;

export const AiCaseAnalysis: React.FC = () => {
  const { refreshUser } = useAuth();
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
  const [followUpQ, setFollowUpQ] = useState('');
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
  const [lastOutcomeType, setLastOutcomeType] = useState<ConsultationOutcomeType | null>(null);
  const [lastMeta, setLastMeta] = useState<ConsultationAnalysisMeta | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const analyzeInFlight = useRef(false);

  const descLen = description.trim().length;
  const showPipeline = analyzing || pipelineFinishing;
  const showResults = Boolean(result) && !showPipeline;
  const showCompose = !showResults;

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

  useEffect(() => {
    const draft = getGuestDraft();
    if (draft?.description) {
      setDescription(draft.description);
      clearGuestDraft();
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) {
      consultationApi.getById(id)
        .then(({ consultation }) => {
          setResult(consultation);
          setChatHistory(consultation.followUpHistory || []);
          if (consultation.description) setDescription(consultation.description);
          if (consultation.category) setCategory(consultation.category);
        })
        .catch((e) => {
          setError(loadErrorMessage(e, 'Could not load the selected analysis.'));
          window.history.replaceState(null, '', '/ai-analysis');
        });
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleAnalyze = async () => {
    if (descLen < MIN_DESCRIPTION_CHARS) {
      setError(`Please describe your situation in at least ${MIN_DESCRIPTION_CHARS} characters (${descLen}/${MIN_DESCRIPTION_CHARS}).`);
      return;
    }
    if (analyzeInFlight.current) return;
    analyzeInFlight.current = true;
    setError('');
    setAnalyzing(true);
    setPipelineFinishing(false);
    setResult(null);
    setLastOutcomeType(null);

    try {
      const formData = new FormData();
      formData.append('category', category);
      formData.append('description', description);
      if (file) formData.append('document', file);

      const response = await consultationApi.analyze(formData);
      setPipelineFinishing(true);
      await new Promise((r) => setTimeout(r, PIPELINE_FINISH_MS));
      setResult(response.consultation);
      setLastOutcomeType(response.meta?.outcomeType ?? 'full');
      setLastMeta(response.consultation.analysisMeta ?? response.meta ?? null);
      setChatHistory([]);
      await refreshUser();
      setHistory((prev) => [response.consultation, ...prev].slice(0, 10));
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

  const handleFollowUp = async () => {
    if (!result || !followUpQ.trim()) return;
    if (followUpQ.trim().length < 5) {
      setError('Please ask a longer question (at least 5 characters).');
      return;
    }

    setFollowUpLoading(true);
    const askedQuestion = followUpQ;

    try {
      const response = await consultationApi.followUp(result.id, askedQuestion);
      setChatHistory((prev) => [
        ...prev,
        { role: 'user', content: askedQuestion },
        { role: 'assistant', content: response.answer },
      ]);
      setFollowUpQ('');
    } catch (err) {
      setError(getErrorMessage(err, 'Follow-up failed. Please try again.'));
    } finally {
      setFollowUpLoading(false);
    }
  };

  const loadConsultation = (c: ConsultationResult) => {
    setResult(c);
    setChatHistory(c.followUpHistory || []);
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
    setChatHistory([]);
    setFollowUpCount(0);
    setLastOutcomeType(null);
    setLastMeta(null);
    setError('');
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
      navItems={getCitizenNav()}
      stepLabel="Analysis"
      backTo={getAppBackFallback(false)}
    >
      <div className="analysis-describe">
        {showCompose && (
          <>
            <div className="analysis-describe__prompt">
              <h2>Describe your situation</h2>
              <p>A few clear facts help us match the right legal guidance.</p>
            </div>

            <div className="analysis-describe__compose">
              <textarea
                placeholder="Example: My employer terminated me without notice after two years of service in Quezon City."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={showPipeline}
                aria-describedby="desc-char-hint"
              />
              <p
                id="desc-char-hint"
                className={`analysis-describe__hint${descLen > 0 && descLen < MIN_DESCRIPTION_CHARS ? ' analysis-describe__hint--warn' : ''}`}
              >
                {descLen}/{MIN_DESCRIPTION_CHARS} characters
                {descLen > 0 && descLen < MIN_DESCRIPTION_CHARS ? ' — add more detail for a full analysis' : ''}
              </p>

              <span className="analysis-describe__category-label">Category</span>
              <div className="analysis-describe__chips" role="group" aria-label="Case category">
                {categories.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={`analysis-describe__chip${category === c.value ? ' analysis-describe__chip--active' : ''}`}
                    onClick={() => setCategory(c.value)}
                    disabled={showPipeline}
                    aria-pressed={category === c.value}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {!showPipeline && !result && (
                <AnalysisSuggestedQuestions
                  category={category}
                  mode="starters"
                  onSelect={(text) => setDescription(text)}
                />
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
                  disabled={showPipeline}
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

            {showPipeline && (
              <div style={{ marginTop: 16 }}>
                <AnalysisPipelineSteps active={analyzing || pipelineFinishing} complete={pipelineFinishing} />
              </div>
            )}

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
          </>
        )}

        {showResults && result && ar && (
          <>
            <div className="analysis-describe__summary-strip">
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className="label">Your description</span>
                <p>{(result.description || description).slice(0, 220)}{(result.description || description).length > 220 ? '…' : ''}</p>
              </div>
              <div className="analysis-describe__toolbar" style={{ marginBottom: 0, flexShrink: 0 }}>
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

            {missingFacts && missingFacts.length > 0 && (
              <AnalysisSuggestedQuestions
                category={category}
                extraFacts={missingFacts}
                className="analysis-suggested--inline"
                onSelect={(text) => {
                  setFollowUpQ(text);
                  appendSuggestion(text);
                }}
              />
            )}

            {error && (
              <div className="callout-error" role="alert" style={{ marginBottom: 12 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--color-ox-error)' }}>error</span>
                <span className="callout-error__text">{error}</span>
              </div>
            )}

            <div className="followup-block">
              <div className="followup-head">
                <h3 className="followup-head__title">
                  Follow-up questions
                </h3>
              </div>
              {chatHistory.length > 0 && (
                <div className="followup-scroll">
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={msg.role === 'user' ? 'chat-bubble chat-bubble--user' : 'chat-bubble chat-bubble--ai'}>
                      <p className="chat-bubble__role">{msg.role === 'user' ? 'You' : 'Advisor'}</p>
                      <p className="chat-bubble__content">{msg.content}</p>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              )}
              <div className="followup-input-row">
                <input
                  type="text"
                  className="ox-input"
                  placeholder="Ask a follow-up question…"
                  value={followUpQ}
                  onChange={(e) => setFollowUpQ(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleFollowUp()}
                />
                <button
                  type="button"
                  className="ox-btn ox-btn-primary"
                  onClick={handleFollowUp}
                  disabled={followUpLoading || !followUpQ.trim()}
                >
                  {followUpLoading ? '…' : 'Ask'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
};

export default AiCaseAnalysis;
