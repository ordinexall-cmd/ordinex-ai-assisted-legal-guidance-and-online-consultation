import React, { useEffect, useState } from 'react';

const STEPS = [
  'Extracting legal keywords',
  'Matching legal categories',
  'Comparing case similarities',
  'Validating sources & freshness',
  'Generating legal guidance',
] as const;

type StepStatus = 'done' | 'active' | 'pending';

function statusFor(index: number, progress: number, complete: boolean): StepStatus {
  if (complete || progress > index) return 'done';
  if (progress === index) return 'active';
  return 'pending';
}

interface AnalysisPipelineStepsProps {
  readonly active: boolean;
  readonly complete: boolean;
}

export const AnalysisPipelineSteps: React.FC<AnalysisPipelineStepsProps> = ({
  active,
  complete,
}) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!active) {
      setProgress(0);
      return;
    }
    if (complete) {
      setProgress(STEPS.length);
      return;
    }

    setProgress(0);
    const t1 = window.setTimeout(() => setProgress(1), 600);
    const t2 = window.setTimeout(() => setProgress(2), 1200);
    const t3 = window.setTimeout(() => setProgress(3), 1800);
    const t4 = window.setTimeout(() => setProgress(4), 2400);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
    };
  }, [active, complete]);

  if (!active && !complete) return null;

  return (
    <ol className="analysis-pipeline" aria-label="Analysis progress">
      {STEPS.map((label, i) => {
        const status = statusFor(i, progress, complete);
        return (
          <li key={label} className={`analysis-pipeline__step analysis-pipeline__step--${status}`}>
            <span className="analysis-pipeline__icon" aria-hidden>
              {status === 'done' && (
                <span className="material-symbols-outlined">check</span>
              )}
              {status === 'active' && (
                <span className="analysis-pipeline__spinner" />
              )}
              {status === 'pending' && (
                <span className="analysis-pipeline__dot" />
              )}
            </span>
            <span className="analysis-pipeline__label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
};

export default AnalysisPipelineSteps;
