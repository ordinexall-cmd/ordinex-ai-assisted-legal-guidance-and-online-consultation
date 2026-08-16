import React from 'react';
import type { TrustScoreResult } from '../../utils/trustScore';

export interface TrustScoreBadgeProps {
  readonly score: number | TrustScoreResult;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly showTooltip?: boolean;
  readonly className?: string;
  readonly onClick?: () => void;
}

export const TrustScoreBadge: React.FC<TrustScoreBadgeProps> = ({
  score,
  size = 'md',
  showTooltip = true,
  className = '',
  onClick,
}) => {
  const numericScore = typeof score === 'number' ? score : score.score;

  let bg = '#10b981'; // Green
  let label = `${numericScore} / 100`;

  if (numericScore >= 80) {
    bg = '#10b981'; // Emerald Green
  } else if (numericScore >= 60) {
    bg = '#059669'; // Teal / Darker Green
  } else if (numericScore >= 30) {
    bg = '#f59e0b'; // Amber / Orange
  } else {
    bg = '#94a3b8'; // Slate Gray
  }

  const padding = size === 'sm' ? '2px 8px' : size === 'lg' ? '6px 14px' : '4px 10px';
  const fontSize = size === 'sm' ? '0.7rem' : size === 'lg' ? '0.85rem' : '0.75rem';
  const iconSize = size === 'sm' ? '12px' : size === 'lg' ? '16px' : '14px';

  return (
    <span
      className={`trust-score-badge ${className}`}
      onClick={onClick}
      title={showTooltip ? `Identity Proof Trust Score: ${numericScore}/100. Verifies contact, legal address, capacity, and credentials.` : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        backgroundColor: bg,
        color: '#ffffff',
        fontWeight: 700,
        fontSize,
        padding,
        borderRadius: '9999px',
        letterSpacing: '0.04em',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        verticalAlign: 'middle',
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{ fontSize: iconSize, fontWeight: 'bold' }}
        aria-hidden
      >
        verified
      </span>
      <span>{label}</span>
    </span>
  );
};
