import React from 'react';

interface DashHistorySkeletonProps {
  readonly label?: string;
}

export const DashHistorySkeleton: React.FC<DashHistorySkeletonProps> = ({
  label = 'Loading',
}) => (
  <div className="dash-skeleton-list" aria-busy="true" aria-label={label}>
    {[0, 1, 2].map((i) => (
      <div key={i} className="dash-skeleton-row">
        <div className="dash-skeleton-row__thumb" />
        <div className="dash-skeleton-row__lines">
          <div className="dash-skeleton-row__line dash-skeleton-row__line--wide" />
          <div className="dash-skeleton-row__line dash-skeleton-row__line--short" />
        </div>
      </div>
    ))}
  </div>
);

export default DashHistorySkeleton;
