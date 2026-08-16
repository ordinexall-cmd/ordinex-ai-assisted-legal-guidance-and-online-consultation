import React, { useCallback, useMemo, useState } from 'react';
import { BrandLogo } from '../brand/BrandLogo';
import {
  ApiError,
  consultationApi,
  type GuestPreviewResult,
} from '../../services/api';
import { setGuestDraft } from '../../constants/guestDraft';
import { CASE_ANALYSIS_CATEGORIES, type CaseAnalysisCategory } from '../../constants/legalCategories';
import { PreGuidanceResult } from '../analysis/PreGuidanceResult';
import { guestPreviewToAnalysis } from '../../utils/guestPreviewToAnalysis';
import { SITUATION_PLACEHOLDER } from '../../constants/situationPrompt';
import { assessDescriptionFacts } from '../../utils/situationFacts';

const MIN_CHARS = 40;
const MAX_CHARS = 2000;

const STEP_META = [
  { num: 1, title: 'Describe', hint: 'What happened?' },
  { num: 2, title: 'Review', hint: 'We outline the key points' },
  { num: 3, title: 'Get clarity', hint: 'Plain language summary' },
] as const;

type DemoState = 'describe' | 'analyzing' | 'preview' | 'error';
type StepUiState = 'active' | 'next' | 'done' | 'todo';

function stepStatesFor(demoState: DemoState): StepUiState[] {
  switch (demoState) {
    case 'analyzing':
      return ['done', 'active', 'next'];
    case 'preview':
      return ['done', 'done', 'active'];
    default:
      return ['active', 'next', 'todo'];
  }
}

export interface LandingHeroProductDemoProps {
  onSignUp: () => void;
  onSignIn?: () => void;
}

export const LandingHeroProductDemo: React.FC<LandingHeroProductDemoProps> = ({
  onSignUp,
}) => {
  const [demoState, setDemoState] = useState<DemoState>('describe');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CaseAnalysisCategory>('unsure');
  const [preview, setPreview] = useState<GuestPreviewResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [missingFacts, setMissingFacts] = useState<string[]>([]);

  const charCount = description.length;
  const canSubmit = charCount >= MIN_CHARS && charCount <= MAX_CHARS && demoState !== 'analyzing';
  const categoryForApi = selectedCategory;

  const stepStates = useMemo(() => stepStatesFor(demoState), [demoState]);
  const analysis = preview && !preview.requiresLogin && !preview.needsMoreDetail
    ? guestPreviewToAnalysis(preview)
    : null;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setErrorMessage('');
    const facts = assessDescriptionFacts(description.trim());
    if (!facts.ready) {
      setMissingFacts(facts.missing.map((m) => m.label));
      setPreview(null);
      setDemoState('describe');
      return;
    }
    setMissingFacts([]);
    setDemoState('analyzing');
    try {
      const result = await consultationApi.preview({
        description: description.trim(),
        category: categoryForApi,
      });
      if (result.needsMoreDetail) {
        setMissingFacts(result.missingFacts || facts.missing.map((m) => m.label));
        setPreview(null);
        setDemoState('describe');
        return;
      }
      setGuestDraft({
        description: description.trim(),
        category: categoryForApi,
      });
      setPreview(result);
      setDemoState('preview');
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Could not generate a preview. Please try again.';
      setErrorMessage(msg);
      setDemoState('error');
    }
  }, [canSubmit, description, categoryForApi]);

  const restartDescribe = () => {
    setPreview(null);
    setMissingFacts([]);
    setDemoState('describe');
  };

  const persistDraft = (opts: { autoAnalyze?: boolean; intent?: 'analyze' | 'lawyers' } = {}) => {
    setGuestDraft({
      description: description.trim(),
      category: categoryForApi || preview?.matchSpecialty,
      autoAnalyze: Boolean(opts.autoAnalyze),
      intent: opts.intent || 'analyze',
    });
  };

  const unlockWithDraft = (opts: { autoAnalyze?: boolean; intent?: 'analyze' | 'lawyers' } = {}) => {
    persistDraft(opts);
    onSignUp();
  };

  const needsLogin = Boolean(preview?.requiresLogin);

  const loginFooter = (
    <div className="landing-product-demo__post-actions">
      <button
        type="button"
        className="ox-btn ox-btn-primary"
        onClick={() => unlockWithDraft({ autoAnalyze: true, intent: 'analyze' })}
      >
        Sign in
      </button>
      <button type="button" className="ox-btn ox-btn-outline landing-product-demo__restart-btn" onClick={restartDescribe}>
        Analyze another situation
      </button>
    </div>
  );

  return (
    <div
      className={`landing-product-demo landing-product-demo--${demoState}${
        demoState === 'preview' ? ' landing-product-demo--preview-visible' : ''
      }`}
      data-demo-state={demoState}
    >
      <aside className="landing-product-demo__rail">
        <BrandLogo size="sm" showWordmark={false} className="landing-product-demo__logo" />
        <ol className="landing-product-demo__steps">
          {STEP_META.map((step, index) => (
            <li
              key={step.num}
              className={`landing-product-demo__step landing-product-demo__step--${stepStates[index]}`}
            >
              <span className="landing-product-demo__step-dot">
                {stepStates[index] === 'done' ? (
                  <span className="material-symbols-outlined" aria-hidden>
                    check
                  </span>
                ) : (
                  step.num
                )}
              </span>
              <span className="landing-product-demo__step-text">
                <strong>{step.title}</strong>
                <span>{step.hint}</span>
              </span>
            </li>
          ))}
        </ol>
      </aside>

      <div className="landing-product-demo__main">
        {demoState === 'preview' && preview ? (
          needsLogin ? (
            <>
              <div className="landing-product-demo__preview-head">
                <h2 className="landing-product-demo__heading">No preloaded match</h2>
              </div>
              <div className="landing-product-demo__analysis-section">
                <h3>Sign in to continue</h3>
                <p className="landing-product-demo__complex-desc">
                  This situation is not covered by our preloaded Philippine case guides. Create a free account so we can search official sources (Official Gazette, LawPhil, Supreme Court e-Library), save your history, and match you with a verified lawyer.
                </p>
                {loginFooter}
              </div>
            </>
          ) : analysis ? (
            <PreGuidanceResult
              ar={analysis}
              category={categoryForApi || preview.matchSpecialty}
              variant="landing"
              onConsultLawyer={() => unlockWithDraft({ autoAnalyze: false, intent: 'lawyers' })}
              onAnalyzeAnother={restartDescribe}
            />
          ) : null
        ) : (
          <>
            <h2 className="landing-product-demo__heading">What happened?</h2>

            <label className="landing-demo-category">
              <span className="landing-demo-category__label">Legal category</span>
              <span className="landing-demo-category__hint">This helps match the right Philippine rules.</span>
              <select
                className="landing-demo-category__select"
                value={selectedCategory}
                disabled={demoState === 'analyzing'}
                aria-label="Legal category"
                onChange={(e) => setSelectedCategory(e.target.value as CaseAnalysisCategory)}
              >
                {CASE_ANALYSIS_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="landing-product-demo__field">
              <textarea
                id="landing-demo-description"
                className="landing-product-demo__textarea"
                aria-label="Describe your situation"
                placeholder={SITUATION_PLACEHOLDER}
                value={description}
                maxLength={MAX_CHARS}
                rows={6}
                disabled={demoState === 'analyzing'}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (demoState === 'error') setDemoState('describe');
                }}
                aria-describedby="landing-demo-char-count"
                aria-invalid={demoState === 'error'}
              />
            </div>
            <span
              id="landing-demo-char-count"
              className={`landing-product-demo__count${
                charCount < MIN_CHARS ? ' landing-product-demo__count--low' : ''
              }`}
            >
              {charCount} / {MAX_CHARS}
            </span>

            {missingFacts.length > 0 ? (
              <div className="landing-product-demo__missing" role="status">
                <strong>Add these details for an accurate outline</strong>
                <ul>
                  {missingFacts.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {demoState === 'error' && errorMessage ? (
              <p className="landing-product-demo__error" role="alert">
                {errorMessage}
              </p>
            ) : null}

            {demoState === 'analyzing' ? (
              <p className="landing-product-demo__analyzing" aria-live="polite">
                <span className="material-symbols-outlined landing-product-demo__spinner" aria-hidden>
                  progress_activity
                </span>
                Analyzing your situation…
              </p>
            ) : (
              <button
                type="button"
                className="ox-btn ox-btn-primary landing-product-demo__submit"
                disabled={!canSubmit}
                onClick={() => void handleSubmit()}
              >
                Get preview
                <span className="material-symbols-outlined" aria-hidden>
                  arrow_forward
                </span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default LandingHeroProductDemo;
