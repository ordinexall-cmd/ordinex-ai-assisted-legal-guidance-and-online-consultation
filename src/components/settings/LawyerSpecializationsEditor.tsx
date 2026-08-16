import React, { useEffect, useId, useRef, useState } from 'react';
import { LEGAL_PRACTICE_AREAS, specialtyDisplayLabel } from '../../constants/legalCategories';

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
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = (area: string) => {
    if (disabled) return;
    if (value.includes(area)) onChange(value.filter((v) => v !== area));
    else onChange([...value, area]);
  };

  return (
    <div className="lawyer-spec-editor" ref={wrapRef}>
      <p className="workbench-panel-helper lawyer-spec-editor__helper">{helperText}</p>
      <button
        type="button"
        className="ox-input lawyer-spec-editor__trigger"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          {value.length === 0
            ? 'Select practice areas'
            : `${value.length} selected`}
        </span>
        <span className="material-symbols-outlined" aria-hidden>expand_more</span>
      </button>
      {open && (
        <ul
          id={listId}
          className="lawyer-spec-editor__list"
          role="listbox"
          aria-multiselectable="true"
          aria-label="Practice areas"
        >
          {LEGAL_PRACTICE_AREAS.map((area) => {
            const selected = value.includes(area.value);
            return (
              <li key={area.value} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`lawyer-spec-editor__opt${selected ? ' is-selected' : ''}`}
                  onClick={() => toggle(area.value)}
                >
                  <span className="material-symbols-outlined" aria-hidden>
                    {selected ? 'check_box' : 'check_box_outline_blank'}
                  </span>
                  {area.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {value.length > 0 && (
        <ul className="lawyer-spec-editor__chips">
          {value.map((v) => (
            <li key={v}>
              <button
                type="button"
                className="lawyer-spec-editor__chip"
                disabled={disabled}
                onClick={() => toggle(v)}
                aria-label={`Remove ${specialtyDisplayLabel(v)}`}
              >
                {specialtyDisplayLabel(v)}
                <span className="material-symbols-outlined" aria-hidden>close</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LawyerSpecializationsEditor;
