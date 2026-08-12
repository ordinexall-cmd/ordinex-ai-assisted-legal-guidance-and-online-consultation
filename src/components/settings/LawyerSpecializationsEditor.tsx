import React from 'react';
import { LEGAL_PRACTICE_AREAS } from '../../constants/legalCategories';

export interface LawyerSpecializationsEditorProps {
  readonly value: string[];
  readonly onChange: (next: string[]) => void;
  readonly disabled?: boolean;
  readonly helperText?: string;
}

export const LawyerSpecializationsEditor: React.FC<LawyerSpecializationsEditorProps> = ({
  value,
  onChange,
  disabled = false,
  helperText = 'Citizens are matched to you based on these areas after AI case analysis.',
}) => {
  const toggle = (area: string) => {
    if (disabled) return;
    if (value.includes(area)) {
      onChange(value.filter((v) => v !== area));
    } else {
      onChange([...value, area]);
    }
  };

  return (
    <div className="lawyer-spec-editor">
      <p className="workbench-panel-helper lawyer-spec-editor__helper">{helperText}</p>
      <div className="payment-option-grid" role="group" aria-label="Practice areas">
        {LEGAL_PRACTICE_AREAS.map((area) => {
          const selected = value.includes(area.value);
          return (
            <button
              key={area.value}
              type="button"
              disabled={disabled}
              className={`payment-option-card${selected ? ' is-selected' : ''}`}
              onClick={() => toggle(area.value)}
              aria-pressed={selected}
            >
              <span className="material-symbols-outlined" aria-hidden>gavel</span>
              {area.label}
            </button>
          );
        })}
      </div>
      {value.length > 0 && (
        <p className="workbench-panel-helper" style={{ marginTop: 8 }}>
          Selected: {value.join(', ')}
        </p>
      )}
    </div>
  );
};

export default LawyerSpecializationsEditor;
