import React from 'react';
import { Link } from 'react-router-dom';

/** Philippine legal research sources — same basis set used on the PAO Ordinex citizen footer. */
const GOV_LINKS = [
  { label: 'Official Gazette', url: 'https://www.officialgazette.gov.ph/' },
  { label: 'Department of Justice', url: 'https://www.doj.gov.ph/' },
  { label: 'Supreme Court e-Library', url: 'https://elibrary.judiciary.gov.ph/' },
  { label: 'LawPhil', url: 'https://lawphil.net/' },
] as const;

/**
 * GOV.PH-style landing footer — layout/details mirrored from
 * D:\New folder\ORDINEX CitizenFooter (gray grid + bottom credits).
 */
export const LandingGovFooter: React.FC = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="landing-gov-footer">
      <div className="landing-gov-footer__main">
        <div className="landing-gov-footer__grid">
          <div className="landing-gov-footer__col">
            <h4>Ordinex</h4>
            <p className="landing-gov-footer__italic">
              Legal clarity for Filipinos · AI pre-guidance, then counsel when you need it
            </p>
            <p>
              Ordinex helps you organize a legal situation in plain language, then connect with
              a lawyer when you are ready. AI output is guidance only — not a substitute for
              advice from a licensed Philippine counsel.
            </p>
          </div>

          <div className="landing-gov-footer__col">
            <h4>Platform</h4>
            <ul>
              <li>Free preview on the home page</li>
              <li>Full analysis after you create an account</li>
              <li>Browse lawyers and pay at booking</li>
              <li>Privacy-minded under RA 10173</li>
            </ul>
          </div>

          <div className="landing-gov-footer__col">
            <h4>Quick links</h4>
            <ul>
              <li><Link to="/#experience">How it works</Link></li>
              <li><Link to="/#faq">FAQ</Link></li>
              <li><Link to="/privacy">Privacy</Link></li>
              <li><Link to="/terms">Terms</Link></li>
              <li><Link to="/licenses">Licenses</Link></li>
              <li><Link to="/register">Create account</Link></li>
            </ul>
          </div>

          <div className="landing-gov-footer__col">
            <h4>Government links</h4>
            <p className="landing-gov-footer__italic">
              Public sources that inform Philippine legal research and case identification.
            </p>
            <ul>
              {GOV_LINKS.map((l) => (
                <li key={l.label}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="landing-gov-footer__bottom">
        <span>
          &copy; {year} <strong className="landing-brand-type">ORDINEX</strong> Legal Tech.
          All rights reserved.
        </span>
        <span className="landing-gov-footer__credits">
          Capstone system by Rainhoa Jean D. Placer and JM G. Inojales, Assumption College of Davao.
        </span>
      </div>
    </footer>
  );
};

export default LandingGovFooter;
