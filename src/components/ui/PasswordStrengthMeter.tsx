import React, { useMemo } from 'react';

export interface PasswordStrengthMeterProps {
  readonly password: string;
  readonly className?: string;
  readonly showChecklist?: boolean;
}

export interface PasswordCriterion {
  readonly id: string;
  readonly label: string;
  readonly valid: boolean;
}

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({
  password,
  className = '',
  showChecklist = true,
}) => {
  const criteria: PasswordCriterion[] = useMemo(() => [
    { id: 'min_length', label: '8+ characters', valid: password.length >= 8 },
    { id: 'has_upper', label: 'Uppercase letter (A-Z)', valid: /[A-Z]/.test(password) },
    { id: 'has_lower', label: 'Lowercase letter (a-z)', valid: /[a-z]/.test(password) },
    { id: 'has_number', label: 'Number (0-9)', valid: /[0-9]/.test(password) },
    { id: 'has_special', label: 'Special symbol (!@#$%)', valid: /[^A-Za-z0-9]/.test(password) },
  ], [password]);

  const passedCount = criteria.filter((c) => c.valid).length;
  const percentage = (passedCount / criteria.length) * 100;

  const strengthMeta = useMemo(() => {
    if (!password) return { text: 'Empty', color: '#94a3b8', bg: '#e2e8f0' };
    if (passedCount <= 2) return { text: 'Weak', color: '#ef4444', bg: '#ef4444' };
    if (passedCount <= 3) return { text: 'Fair', color: '#f59e0b', bg: '#f59e0b' };
    if (passedCount <= 4) return { text: 'Good', color: '#3b82f6', bg: '#3b82f6' };
    return { text: 'Strong', color: '#10b981', bg: '#10b981' };
  }, [password, passedCount]);

  if (!password && !showChecklist) return null;

  return (
    <div className={`password-strength-meter ${className}`} style={{ marginTop: '0.4rem', marginBottom: '0.6rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-ox-text-muted, #64748b)' }}>Password strength:</span>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: strengthMeta.color }}>{strengthMeta.text}</span>
      </div>

      <div
        style={{
          width: '100%',
          height: '4px',
          backgroundColor: '#e2e8f0',
          borderRadius: '9999px',
          overflow: 'hidden',
          marginBottom: showChecklist ? '8px' : '0',
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            backgroundColor: strengthMeta.bg,
            transition: 'width 0.25s ease, background-color 0.25s ease',
          }}
        />
      </div>

      {showChecklist && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '4px 8px',
            fontSize: '0.7rem',
          }}
        >
          {criteria.map((c) => (
            <div
              key={c.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: c.valid ? '#10b981' : '#94a3b8',
                transition: 'color 0.2s ease',
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: '12px', fontWeight: 'bold' }}
                aria-hidden
              >
                {c.valid ? 'check_circle' : 'radio_button_unchecked'}
              </span>
              <span>{c.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
