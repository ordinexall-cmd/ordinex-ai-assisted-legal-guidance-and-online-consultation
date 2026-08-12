import React from 'react';

interface ApiLoadBannerProps {
  readonly message: string;
  readonly onRetry?: () => void;
}

/** Shown when a dashboard failed to load data from the API. */
export const ApiLoadBanner: React.FC<ApiLoadBannerProps> = ({ message, onRetry }) => (
  <div className="callout-error dash-callout-error" role="alert">
    <p className="callout-error__text">{message}</p>
    {onRetry && (
      <button type="button" className="ox-btn ox-btn-ghost ox-btn-sm" onClick={onRetry}>
        Try again
      </button>
    )}
  </div>
);

export default ApiLoadBanner;
