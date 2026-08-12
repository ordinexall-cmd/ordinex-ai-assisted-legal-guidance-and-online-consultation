import React from 'react';

/**
 * Fixed atmospheric layer: warm blooms, sage side edges, gold dots and stars.
 */
export const LandingAmbientLights: React.FC = () => (
  <div className="landing-ambient" aria-hidden>
    <span className="landing-ambient__orb landing-ambient__orb--gold" />
    <span className="landing-ambient__orb landing-ambient__orb--warm" />
    <span className="landing-ambient__orb landing-ambient__orb--sage landing-ambient__orb--sage-left" />
    <span className="landing-ambient__orb landing-ambient__orb--sage landing-ambient__orb--sage-right" />
    <span className="landing-ambient__orb landing-ambient__orb--sage landing-ambient__orb--sage-tr" />
    <span className="landing-ambient__orb landing-ambient__orb--sage landing-ambient__orb--sage-bl" />
    <span className="landing-ambient__ring landing-ambient__ring--a" />
    <span className="landing-ambient__ring landing-ambient__ring--b" />
    <span className="landing-ambient__beam" />
    <span className="landing-ambient__dots landing-ambient__dots--tl" />
    <span className="landing-ambient__dots landing-ambient__dots--bl" />
    <span className="landing-ambient__dots landing-ambient__dots--br" />
  </div>
);

export default LandingAmbientLights;
