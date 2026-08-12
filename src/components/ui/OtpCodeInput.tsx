import React, { useRef } from 'react';

export interface OtpCodeInputProps {
  value: string;
  onChange: (code: string) => void;
  length?: number;
  disabled?: boolean;
  id?: string;
}

/**
 * Six single-digit boxes with paste and keyboard navigation.
 */
export const OtpCodeInput: React.FC<OtpCodeInputProps> = ({
  value,
  onChange,
  length = 6,
  disabled,
  id,
}) => {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.replace(/\D/g, '').slice(0, length).split('');
  while (digits.length < length) digits.push('');

  const setAt = (index: number, char: string) => {
    const next = digits.slice();
    next[index] = char;
    onChange(next.join('').replace(/\s/g, ''));
  };

  const focusAt = (index: number) => {
    refs.current[index]?.focus();
    refs.current[index]?.select();
  };

  const applyPaste = (text: string, startIndex: number) => {
    const chars = text.replace(/\D/g, '').slice(0, length - startIndex).split('');
    const next = digits.slice();
    chars.forEach((c, i) => {
      next[startIndex + i] = c;
    });
    onChange(next.join('').slice(0, length));
    const nextFocus = Math.min(startIndex + chars.length, length - 1);
    focusAt(nextFocus);
  };

  return (
    <div
      className="otp-code-input"
      id={id}
      role="group"
      aria-label={`${length}-digit verification code`}
    >
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          className="otp-code-input__cell"
          maxLength={1}
          value={d}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '');
            if (!v) {
              setAt(i, '');
              return;
            }
            if (v.length > 1) {
              applyPaste(v, i);
              return;
            }
            setAt(i, v);
            if (i < length - 1) focusAt(i + 1);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !digits[i] && i > 0) {
              e.preventDefault();
              setAt(i - 1, '');
              focusAt(i - 1);
            }
            if (e.key === 'ArrowLeft' && i > 0) focusAt(i - 1);
            if (e.key === 'ArrowRight' && i < length - 1) focusAt(i + 1);
          }}
          onPaste={(e) => {
            e.preventDefault();
            const text = e.clipboardData.getData('text');
            if (text) applyPaste(text, i);
          }}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
};
