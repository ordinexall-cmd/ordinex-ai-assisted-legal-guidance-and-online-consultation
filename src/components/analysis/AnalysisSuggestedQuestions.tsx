import React from 'react';

const QUESTIONS_BY_CATEGORY: Record<string, readonly string[]> = {
  Family: [
    'Was there a marriage certificate or prior court order?',
    'Are children or custody issues involved?',
    'Do you have supporting documents ready?',
  ],
  Criminal: [
    'What is the date and place of the incident?',
    'Was a police report or blotter filed?',
    'What is your current status (summoned, detained, etc.)?',
  ],
  Labor: [
    'Was there a written employment contract?',
    'Did you receive formal notice before termination?',
    'Are there witnesses or HR records available?',
  ],
  Property: [
    'Who holds the title or lease agreement?',
    'What are the key dates in the dispute?',
    'Have you sent any demand letters?',
  ],
  Consumer: [
    'Do you have receipts or proof of purchase?',
    'Did you contact the merchant or DTI?',
    'What remedy are you seeking?',
  ],
  Cybercrime: [
    'When did the online incident occur?',
    'Do you have screenshots or digital evidence?',
    'Have you reported it to authorities?',
  ],
  'Data Privacy': [
    'What personal data was involved?',
    'Which organization handled the data?',
    'Have you filed a complaint with the NPC?',
  ],
  unsure: [
    'What are the key dates of events?',
    'Who are the main parties involved?',
    'What documents do you already have?',
  ],
};

const STARTER_PROMPTS: readonly string[] = [
  'My employer terminated me without notice after two years of service.',
  'My spouse and I are separating and we disagree about custody.',
  'Someone online is using my photos and personal information.',
];

const DEFAULT_QUESTIONS = QUESTIONS_BY_CATEGORY.unsure;

export function getSuggestedQuestions(category: string): readonly string[] {
  return QUESTIONS_BY_CATEGORY[category] ?? DEFAULT_QUESTIONS;
}

interface AnalysisSuggestedQuestionsProps {
  readonly category: string;
  readonly extraFacts?: readonly string[];
  readonly className?: string;
  /** When set, chips are tappable and call this with the chip text. */
  readonly onSelect?: (text: string) => void;
  /** Idle compose starters instead of accuracy hints. */
  readonly mode?: 'hints' | 'starters';
}

export const AnalysisSuggestedQuestions: React.FC<AnalysisSuggestedQuestionsProps> = ({
  category,
  extraFacts,
  className = '',
  onSelect,
  mode = 'hints',
}) => {
  const hints = mode === 'starters'
    ? STARTER_PROMPTS
    : (extraFacts?.length ? extraFacts : getSuggestedQuestions(category));
  const heading = mode === 'starters'
    ? 'Try a starter:'
    : (extraFacts?.length ? 'Still needed — tap to add:' : 'To improve accuracy — tap to add:');

  return (
    <div className={`analysis-suggested${className ? ` ${className}` : ''}`}>
      <p className="analysis-suggested__heading">{heading}</p>
      {onSelect ? (
        <div className="analysis-suggested__chips">
          {hints.map((q) => (
            <button
              key={q}
              type="button"
              className="analysis-suggested__chip"
              onClick={() => onSelect(q)}
            >
              {q}
            </button>
          ))}
        </div>
      ) : (
        <ul className="analysis-suggested__list">
          {hints.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AnalysisSuggestedQuestions;
