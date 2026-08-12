import React from 'react';

interface LawyerPracticeBadgeProps {
  readonly practiceType?: string | null;
}

/** Private-only marketplace — badge always shows private practice. */
export const LawyerPracticeBadge: React.FC<LawyerPracticeBadgeProps> = () => (
  <span className="lawyer-badge lawyer-badge--private">Private practice</span>
);

export default LawyerPracticeBadge;
