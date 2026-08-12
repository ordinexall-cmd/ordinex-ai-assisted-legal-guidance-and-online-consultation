import React from 'react';
import { isValidPhilippinePhoneLocal } from '../../utils/phonePhilippines';

export interface PhoneInputProps {
  /** Local mobile digits after +63 (9XXXXXXXXX). */
  value: string;
  onChange: (localDigits: string) => void;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  inputClassName?: string;
  'aria-invalid'?: boolean;
}

/**
 * +63 prefix with local 10-digit input (starts with 9).
 */
export const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
  id,
  disabled,
  required,
  inputClassName = 'landing-input',
  'aria-invalid': ariaInvalid,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let digits = e.target.value.replace(/\D/g, '');
    if (digits.startsWith('0')) digits = digits.slice(1);
    if (digits.length > 10) digits = digits.slice(0, 10);
    onChange(digits);
  };

  const valid = !value || isValidPhilippinePhoneLocal(value);

  return (
    <div className={`phone-split phone-split--auth${!valid ? ' phone-split--invalid' : ''}`}>
      <span className="phone-split__cc" aria-hidden>
        +63
      </span>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        className={`phone-split__input${inputClassName ? ` ${inputClassName}` : ''}`}
        placeholder="9XX XXX XXXX"
        value={value}
        onChange={handleChange}
        disabled={disabled}
        required={required}
        aria-invalid={ariaInvalid ?? (!valid && value.length > 0)}
        aria-describedby={id ? `${id}-hint` : undefined}
        maxLength={12}
      />
    </div>
  );
};
