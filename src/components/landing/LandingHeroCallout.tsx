import React from 'react';

export interface LandingHeroCalloutProps {
  visible?: boolean;
}

export const LandingHeroCallout: React.FC<LandingHeroCalloutProps> = ({ visible = true }) => {
  if (!visible) return null;

  return (
    <div className="landing-hero-callout">
      <p className="landing-hero-callout__text">AI helps you organize your thoughts</p>
      <svg className="landing-hero-callout__arrow" viewBox="0 0 64 48" fill="none" aria-hidden>
        <path
          d="M8 40 C24 38, 32 28, 48 18 C52 14, 54 12, 58 8"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

export default LandingHeroCallout;
