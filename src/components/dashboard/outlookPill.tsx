import type { CourtWinLevel } from '../../services/api';

export function outlookPill(level: CourtWinLevel | undefined) {
  const pillClass = level === 'Strong' ? 'pill-success' : level === 'Uncertain' || level === 'Weak' ? 'pill-pending' : 'pill-success';
  const dotClass = level === 'Strong' ? 'dot-success' : level === 'Uncertain' || level === 'Weak' ? 'dot-gold' : 'dot-success';
  return (
    <span className={`pill pill--compact ${pillClass}`}>
      <span className={`dot ${dotClass}`} />
      {level || 'N/A'}
    </span>
  );
}
