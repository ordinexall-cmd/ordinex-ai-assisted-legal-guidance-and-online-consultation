import React from 'react';

interface LawyerCardSkeletonProps {
  readonly count?: number;
  readonly variant?: 'grid' | 'tile' | 'portrait';
  readonly label?: string;
}

export const LawyerCardSkeleton: React.FC<LawyerCardSkeletonProps> = ({
  count = 8,
  variant = 'grid',
  label = 'Loading lawyers',
}) => {
  if (variant === 'portrait') {
    return (
      <div className="dir-lawyer-grid" aria-busy="true" aria-label={label}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="dir-lawyer-card dir-lawyer-card--skeleton" />
        ))}
      </div>
    );
  }

  if (variant === 'tile') {
    return (
      <div className="directory-card-grid directory-card-grid--tiles" aria-busy="true" aria-label="Loading lawyers">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="lawyer-card-skeleton ox-card lawyer-directory-card--tile">
            <div className="lawyer-card-skeleton__row">
              <div className="lawyer-card-skeleton__avatar" />
              <div className="lawyer-card-skeleton__lines">
                <div className="lawyer-card-skeleton__line lawyer-card-skeleton__line--wide" />
                <div className="lawyer-card-skeleton__line lawyer-card-skeleton__line--mid" />
              </div>
            </div>
            <div className="lawyer-card-skeleton__line lawyer-card-skeleton__line--short" />
            <div className="lawyer-card-skeleton__line lawyer-card-skeleton__line--mid" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="lawyer-grid" aria-busy="true" aria-label="Loading lawyers">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="lawyer-card-skeleton ox-card">
          <div className="lawyer-card-skeleton__row">
            <div className="lawyer-card-skeleton__avatar" />
            <div className="lawyer-card-skeleton__lines">
              <div className="lawyer-card-skeleton__line lawyer-card-skeleton__line--wide" />
              <div className="lawyer-card-skeleton__line lawyer-card-skeleton__line--mid" />
            </div>
          </div>
          <div className="lawyer-card-skeleton__line lawyer-card-skeleton__line--short" />
          <div className="lawyer-card-skeleton__line lawyer-card-skeleton__line--mid" />
        </div>
      ))}
    </div>
  );
};

export default LawyerCardSkeleton;
