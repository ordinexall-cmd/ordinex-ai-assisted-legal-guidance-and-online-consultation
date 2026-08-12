import React, { useCallback, useMemo, useState } from 'react';
import { BrandLogo } from '../brand/BrandLogo';
import { outlookPill } from '../dashboard/outlookPill';
import {
  ApiError,
  consultationApi,
  type CourtWinLevel,
  type GuestPreviewResult,
} from '../../services/api';
import { setGuestDraft } from '../../constants/guestDraft';

const MIN_CHARS = 40;
const MAX_CHARS = 2000;

const STEP_META = [
  { num: 1, title: 'Describe', hint: 'What happened?' },
  { num: 2, title: 'Review', hint: 'We outline the key points' },
  { num: 3, title: 'Get clarity', hint: 'Plain language summary' },
] as const;

const TRUST_PILLS = [
  { icon: 'shield', title: 'Private & secure', text: 'Your data is encrypted.' },
  { icon: 'schedule', title: 'Fast & easy', text: 'Results in minutes.' },
  { icon: 'person', title: 'Lawyer-ready', text: 'Share with confidence.' },
];

const LOCKED_SECTIONS = [
  { title: 'Situation summary', lines: ['Timeline of events and parties involved…', 'Key facts organized for counsel…'] },
  { title: 'Issues identified', lines: ['Labor Code notice requirements…', 'Potential procedural gaps…'] },
  { title: 'Suggested next steps', lines: ['Documents to gather before consult…', 'Questions to ask your lawyer…'] },
];

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
  onSignIn,
}) => {
  const [demoState, setDemoState] = useState<DemoState>('describe');
  const [description, setDescription] = useState('');
  const [preview, setPreview] = useState<GuestPreviewResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const charCount = description.length;
  const canSubmit = charCount >= MIN_CHARS && charCount <= MAX_CHARS && demoState !== 'analyzing';

  const stepStates = useMemo(() => stepStatesFor(demoState), [demoState]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setErrorMessage('');
    setDemoState('analyzing');
    try {
      const result = await consultationApi.preview({ description: description.trim() });
      setGuestDraft({ description: description.trim() });
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
  }, [canSubmit, description]);

  const outlookLevel = preview?.outlookLevel as CourtWinLevel | undefined;

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
          <>
            <div className="landing-product-demo__preview-head">
              <h2 className="landing-product-demo__heading">Your preview</h2>
              {preview.caseHint ? (
                <span className="landing-product-demo__case-hint">{preview.caseHint}</span>
              ) : null}
            </div>
            <div
              className="landing-product-demo__preview-line"
              aria-live="polite"
              role="status"
            >
              <p>{preview.previewLine}</p>
              <p className="landing-product-demo__preview-law-hint">
                {preview.lawHintLine ||
                  'Possible legal basis identified. Sign in to view the exact law references and full reasoning.'}
              </p>
              <div className="landing-product-demo__preview-outlook">
                {outlookPill(outlookLevel)}
              </div>
            </div>
            <div className="landing-product-demo__locked-wrap">
              {LOCKED_SECTIONS.map((section) => (
                <div key={section.title} className="landing-product-demo__locked-section">
                  <h3>{section.title}</h3>
                  {section.lines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              ))}
              <div className="landing-product-demo__locked-overlay">
                <p>Sign in to unlock your full analysis</p>
                <button type="button" className="ox-btn ox-btn-primary" onClick={onSignUp}>
                  Create free account
                </button>
                {onSignIn ? (
                  <button
                    type="button"
                    className="landing-product-demo__signin-link"
                    onClick={onSignIn}
                  >
                    Already have an account? Sign in
                  </button>
                ) : null}
              </div>
            </div>
            {preview.disclaimer ? (
              <p className="landing-product-demo__disclaimer">{preview.disclaimer}</p>
            ) : null}
          </>
        ) : (
          <>
            <h2 className="landing-product-demo__heading">What happened?</h2>
            <div className="landing-product-demo__field">
              <textarea
                id="landing-demo-description"
                className="landing-product-demo__textarea"
                aria-label="Describe your situation"
                placeholder="Type your situation in your own words…"
                value={description}
                maxLength={MAX_CHARS}
                rows={5}
                disabled={demoState === 'analyzing'}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (demoState === 'error') setDemoState('describe');
                }}
                aria-describedby="landing-demo-char-count"
                aria-invalid={demoState === 'error'}
              />
              <span
                id="landing-demo-char-count"
                className={`landing-product-demo__count${
                  charCount < MIN_CHARS ? ' landing-product-demo__count--low' : ''
                }`}
              >
                {charCount} / {MAX_CHARS}
              </span>
            </div>

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

            <div className="landing-product-demo__pills">
              {TRUST_PILLS.map((pill) => (
                <div key={pill.title} className="landing-product-demo__pill">
                  <span className="material-symbols-outlined" aria-hidden>
                    {pill.icon}
                  </span>
                  <span className="landing-product-demo__pill-copy">
                    <strong>{pill.title}</strong>
                    <span className="landing-product-demo__pill-desc">{pill.text}</span>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LandingHeroProductDemo;
