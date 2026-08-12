import React from 'react';

export const LawyerProfileSkeleton: React.FC = () => (
  <div className="booking-layout booking-layout--skeleton" aria-busy="true" aria-label="Loading profile">
    <div className="booking-stack">
      <div className="lawyer-profile-skeleton-card ox-card">
        <div className="lawyer-profile-skeleton-card__hero">
          <div className="lawyer-profile-skeleton-card__avatar" />
          <div className="lawyer-profile-skeleton-card__lines">
            <div className="lawyer-card-skeleton__line lawyer-card-skeleton__line--wide" />
            <div className="lawyer-card-skeleton__line lawyer-card-skeleton__line--mid" />
            <div className="lawyer-card-skeleton__line lawyer-card-skeleton__line--short" />
          </div>
        </div>
        <div className="lawyer-card-skeleton__line lawyer-card-skeleton__line--wide" />
      </div>
      <div className="lawyer-profile-skeleton-card ox-card lawyer-profile-skeleton-card--short" />
    </div>
    <div className="booking-stack">
      <div className="lawyer-profile-skeleton-card ox-card lawyer-profile-skeleton-card--cta" />
      <div className="lawyer-profile-skeleton-card ox-card lawyer-profile-skeleton-card--short" />
    </div>
  </div>
);

export default LawyerProfileSkeleton;
