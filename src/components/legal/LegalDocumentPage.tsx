import React from 'react';
import { Link } from 'react-router-dom';
import { MarketingNav } from '../shell/MarketingNav';
import { LandingGovFooter } from '../landing/LandingGovFooter';
import type { LegalDocument } from '../../content/legalDocuments';

interface LegalDocumentPageProps {
  readonly doc: LegalDocument;
  readonly activePath: '/privacy' | '/terms' | '/licenses';
}

const LINKS = [
  { to: '/privacy' as const, label: 'Privacy' },
  { to: '/terms' as const, label: 'Terms' },
  { to: '/licenses' as const, label: 'Licenses' },
];

export const LegalDocumentPage: React.FC<LegalDocumentPageProps> = ({ doc, activePath }) => (
  <div className="landing-page">
    <MarketingNav />
    <main className="marketing-canvas legal-doc-page" id="main-content" tabIndex={-1}>
      <header className="legal-doc-page__head">
        <p className="legal-doc-page__effective">{doc.effective}</p>
        <h1 className="legal-doc-page__title">{doc.title}</h1>
        <p className="legal-doc-page__subtitle">{doc.subtitle}</p>
        <nav className="legal-doc-page__tabs" aria-label="Legal documents">
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`legal-doc-page__tab${activePath === l.to ? ' is-active' : ''}`}
              aria-current={activePath === l.to ? 'page' : undefined}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </header>

      <article className="legal-doc-page__body ox-card">
        {doc.sections.map((section) => (
          <section key={section.heading} className="legal-doc-page__section">
            <h2>{section.heading}</h2>
            {section.paragraphs.map((p, i) => (
              <p key={`${section.heading}-p-${i}`}>{p}</p>
            ))}
            {section.bullets && section.bullets.length > 0 && (
              <ul>
                {section.bullets.map((b, i) => (
                  <li key={`${section.heading}-b-${i}`}>{b}</li>
                ))}
              </ul>
            )}
            {section.table && section.table.length > 0 && (
              <dl className="legal-doc-page__dl">
                {section.table.map((row) => (
                  <div key={row.label} className="legal-doc-page__dl-row">
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        ))}
      </article>

      <p className="legal-doc-page__back">
        <Link to="/">Back to home</Link>
      </p>
    </main>
    <LandingGovFooter />
  </div>
);

export default LegalDocumentPage;
