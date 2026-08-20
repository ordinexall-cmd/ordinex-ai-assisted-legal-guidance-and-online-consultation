import React from 'react';

interface DashHistoryEmptyProps {
  readonly onStart: () => void;
}

export const DashHistoryEmpty: React.FC<DashHistoryEmptyProps> = ({ onStart }) => (
  <div className="dash-empty-state">
    <div className="dash-empty-state__icon-wrap" aria-hidden>
      <span className="material-symbols-outlined">psychology</span>
    </div>
    <p className="dash-empty-state__title">No case identifications yet</p>
    <p className="dash-empty-state__text">Run your first case identification — it only takes a few minutes.</p>
    <button type="button" className="ox-btn ox-btn-primary" onClick={onStart}>
      Start case identification
      <span className="material-symbols-outlined dash-icon-sm" aria-hidden>
        arrow_forward
      </span>
    </button>
  </div>
);

export default DashHistoryEmpty;
