import React, { useState } from 'react';

type PasswordInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
> & {
  inputClassName?: string;
};

export const PasswordInput: React.FC<PasswordInputProps> = ({
  inputClassName = 'landing-input',
  className,
  ...props
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`password-input-wrap${className ? ` ${className}` : ''}`}>
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={inputClassName}
        style={{ paddingRight: 40, ...(props.style || {}) }}
      />
      <button
        type="button"
        className="password-input-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
          {visible ? 'visibility_off' : 'visibility'}
        </span>
      </button>
    </div>
  );
};
