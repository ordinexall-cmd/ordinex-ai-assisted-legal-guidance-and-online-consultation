import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { MarketingNav } from '../components/shell/MarketingNav';
import { LandingAmbientLights } from '../components/landing/LandingAmbientLights';
import { LandingHeroBackground } from '../components/landing/LandingHeroBackground';
import { LandingHeroCallout } from '../components/landing/LandingHeroCallout';
import { LandingHeroProductDemo } from '../components/landing/LandingHeroProductDemo';
import { LandingGovFooter } from '../components/landing/LandingGovFooter';
import { AuthModal, type AuthView } from '../components/auth/AuthModal';

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: 'Is this formal legal advice?',
    a: 'No. Ordinex is an assistive pre-guidance tool that organizes facts and references applicable Philippine statutes and jurisprudence. Formal legal representation and binding legal advice can only be provided by a licensed attorney through an online consultation.',
  },
  {
    q: 'What does case identification produce?',
    a: 'A structured pre-guidance outline: legal issues in plain language, statutory citations (Republic Acts, Civil Code, Revised Penal Code), suggested questions for counsel, and flags where evidence or factual details are thin.',
  },
  {
    q: 'Can I test the system without creating an account?',
    a: 'Yes. The home page identifies straightforward matters from the preloaded Philippine legal library. A free account is required for complex matters that need a live search of official legal sites, saved history, and booking a lawyer.',
  },
  {
    q: 'What features are included with a free citizen account?',
    a: 'A free citizen account unlocks case identification for complex matters (live search of official Philippine legal sites), saved history, the verified lawyer directory, scheduling, and encrypted video consultations.',
  },
  {
    q: 'How does payment and escrow protection work?',
    a: 'Ordinex has no monthly membership fee for citizens. When you book a lawyer, the attorney quotes an exact fee after reviewing your case notes. Payment is held in secure platform escrow via PayMongo (GCash, cards) and released only after the consultation concludes.',
  },
  {
    q: 'How does Ordinex protect personal information?',
    a: 'Ordinex strictly complies with the Philippine Data Privacy Act of 2012 (RA 10173). User submissions and personal data are encrypted in transit and at rest, and are shared only with the specific lawyer you book.',
  },
  {
    q: 'How are lawyers verified on Ordinex?',
    a: 'Attorneys undergo credential verification against Supreme Court Roll of Attorneys records, IBP membership status, government identification, and face matching before they are listed in the public directory.',
  },
  {
    q: 'Can I cancel a booked consultation and receive a refund?',
    a: 'Yes. Bookings can be cancelled prior to the scheduled consultation day with automated refund processing to your original payment method under platform escrow rules.',
  },
  {
    q: 'Will case identification always be 100% accurate?',
    a: 'No automated system is infallible. Pre-guidance is intended for preparation and issue-spotting only. Critical legal matters should always be reviewed with a verified lawyer.',
  },
];

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  google_not_configured: 'Google sign-in is not configured on this server.',
  missing_code: 'Google sign-in was cancelled or incomplete. Please try again.',
  no_email: 'Your Google account did not share an email address.',
  missing_token: 'Sign-in link expired. Please try again.',
  session_failed: 'Your session could not be loaded. Please log in again.',
  account_suspended: 'Your account has been suspended.',
  google_failed: 'Google sign-in failed. Please try again.',
  role_mismatch: 'This email is registered under a different account type. Use the correct log in option.',
};

export const LandingPage: React.FC = () => {
  const [showAuth, setShowAuth] = useState(false);
  const authInitialView = useRef<AuthView>('login');
  const authInitialTab = useRef<'citizen' | 'lawyer'>('citizen');
  const [authInitialError, setAuthInitialError] = useState('');

  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const state = location.state as {
      authTab?: 'lawyer';
      register?: boolean;
      openLogin?: boolean;
    } | null;
    if (state?.register && state.authTab === 'lawyer') {
      navigate('/lawyer/register', { replace: true });
      return;
    }
    if (state?.register) {
      navigate('/register?start=1', { replace: true });
      return;
    }
    if (state?.openLogin) {
      authInitialView.current = 'login';
      authInitialTab.current = state.authTab === 'lawyer' ? 'lawyer' : 'citizen';
      setShowAuth(true);
      navigate('.', { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  useEffect(() => {
    const code = searchParams.get('authError');
    if (!code) return;
    setAuthInitialError(AUTH_ERROR_MESSAGES[code] || 'Log in failed. Please try again.');
    setShowAuth(true);
    const next = new URLSearchParams(searchParams);
    next.delete('authError');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const root = document.querySelector('.landing-page');
    if (!root) return;
    const nodes = root.querySelectorAll<HTMLElement>('.landing-reveal');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('landing-reveal--visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -10% 0px' }
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  const openAuth = (view: AuthView, tab: 'citizen' | 'lawyer' = 'citizen') => {
    if (view === 'register') {
      navigate(tab === 'lawyer' ? '/lawyer/register' : '/register');
      return;
    }
    authInitialView.current = view;
    authInitialTab.current = tab;
    setShowAuth(true);
  };

  const verifiedBanner = (location.state as { lawyerVerifiedPendingLogin?: boolean } | null)
    ?.lawyerVerifiedPendingLogin;

  return (
    <div className="landing-page">
      <LandingAmbientLights />
      {verifiedBanner && (
        <div className="landing-verified-banner" role="status">
          Your counsel verification is complete. Log in with your email and password to open your dashboard.
        </div>
      )}

      <div className="marketing-top-band">
        <MarketingNav
          variant="dark"
          authActions="signin-only"
          onSignIn={() => openAuth('login')}
        />
      </div>

      <main id="main-content" className="marketing-canvas" tabIndex={-1}>
        <header className="landing-hero landing-hero--showcase">
          <LandingHeroBackground />
          <div className="landing-hero__glow" aria-hidden />
          <div className="landing-hero__copy">
            <p className="ui-kicker landing-hero__kicker">Philippine legal prep</p>
            <h1 className="landing-hero__title">
              Legal clarity, made{' '}
              <span className="landing-hero__title-em">
                simple.
                <svg
                  className="landing-hero__title-underline"
                  viewBox="0 0 120 8"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <path
                    d="M2 6 Q30 2, 60 5 T118 4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>
            <p className="landing-hero__slogan">
              Type what happened. Get a plain outline you can skim, mark up, or hand to counsel.
            </p>
            <div className="landing-hero__actions">
              <button
                type="button"
                className="ox-btn ox-btn-primary ox-btn-lg landing-hero__cta landing-hero__cta--hero"
                onClick={() => openAuth('register')}
              >
                Create free account
              </button>
              <ul className="landing-hero__trust">
                <li>Free preview on the home page</li>
                <li className="landing-hero__trust-sep" aria-hidden>·</li>
                <li>No credit card</li>
              </ul>
            </div>
          </div>
          <div className="landing-hero__demo-stage">
            <LandingHeroProductDemo
              onSignUp={() => openAuth('register')}
              onSignIn={() => openAuth('login')}
            />
            <LandingHeroCallout />
          </div>
        </header>

        <section className="landing-section ui-section landing-reveal" style={{ maxWidth: '1100px', margin: '0 auto 4rem', padding: '0 1.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <p style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.75rem', color: '#004D40', fontWeight: 700, margin: '0 0 0.5rem' }}>
              Structured Workflow
            </p>
            <h2 style={{ fontFamily: 'Source Serif 4, Georgia, serif', fontSize: '1.85rem', color: '#0f172a', margin: '0 0 0.5rem' }}>
              Three Steps from Concern to Counsel
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0 }}>
              Transparent, accountable, and legally grounded at every step.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            <div style={{ background: '#ffffff', padding: '1.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <span style={{ display: 'inline-block', fontSize: '0.85rem', fontWeight: 700, color: '#004D40', background: '#e6f4ea', padding: '0.2rem 0.6rem', borderRadius: '4px', marginBottom: '0.75rem' }}>
                Step 01
              </span>
              <h3 style={{ fontSize: '1.15rem', color: '#0f172a', margin: '0 0 0.5rem' }}>Describe in Plain Terms</h3>
              <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
                Type your situation in English, Tagalog, or Cebuano. Our system extracts core issues without requiring formal legal terminology.
              </p>
            </div>

            <div style={{ background: '#ffffff', padding: '1.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <span style={{ display: 'inline-block', fontSize: '0.85rem', fontWeight: 700, color: '#004D40', background: '#e6f4ea', padding: '0.2rem 0.6rem', borderRadius: '4px', marginBottom: '0.75rem' }}>
                Step 02
              </span>
              <h3 style={{ fontSize: '1.15rem', color: '#0f172a', margin: '0 0 0.5rem' }}>Read Grounded Outline</h3>
              <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
                Review identified Republic Acts, relevant articles, potential remedies, and evidence checklist to prepare your briefing notes.
              </p>
            </div>

            <div style={{ background: '#ffffff', padding: '1.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <span style={{ display: 'inline-block', fontSize: '0.85rem', fontWeight: 700, color: '#004D40', background: '#e6f4ea', padding: '0.2rem 0.6rem', borderRadius: '4px', marginBottom: '0.75rem' }}>
                Step 03
              </span>
              <h3 style={{ fontSize: '1.15rem', color: '#0f172a', margin: '0 0 0.5rem' }}>Consult Verified Counsel</h3>
              <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
                Schedule a consultation with an attorney specializing in your matter. Funds are safely held in escrow until the session ends.
              </p>
            </div>
          </div>
        </section>

        <section className="landing-reveal" style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', padding: '3.5rem 1.5rem', marginBottom: '4rem' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
              <p style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.75rem', color: '#004D40', fontWeight: 700, margin: '0 0 0.5rem' }}>
                Institutional Standards
              </p>
              <h2 style={{ fontFamily: 'Source Serif 4, Georgia, serif', fontSize: '1.85rem', color: '#0f172a', margin: 0 }}>
                Trust, Compliance & Safety
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
              <div style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1.75rem', color: '#004D40', marginBottom: '0.75rem' }}>
                  verified
                </span>
                <h3 style={{ fontSize: '1.05rem', color: '#0f172a', margin: '0 0 0.5rem' }}>Lawyer Verification</h3>
                <p style={{ color: '#64748b', fontSize: '0.875rem', lineHeight: 1.5, margin: 0 }}>
                  Attorneys are cross-checked against the Supreme Court Roll of Attorneys and IBP good standing.
                </p>
              </div>

              <div style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1.75rem', color: '#004D40', marginBottom: '0.75rem' }}>
                  lock
                </span>
                <h3 style={{ fontSize: '1.05rem', color: '#0f172a', margin: '0 0 0.5rem' }}>Payment Escrow</h3>
                <p style={{ color: '#64748b', fontSize: '0.875rem', lineHeight: 1.5, margin: 0 }}>
                  Fees are held securely by the platform via PayMongo and disbursed only after your consultation completes.
                </p>
              </div>

              <div style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1.75rem', color: '#004D40', marginBottom: '0.75rem' }}>
                  security
                </span>
                <h3 style={{ fontSize: '1.05rem', color: '#0f172a', margin: '0 0 0.5rem' }}>RA 10173 Compliance</h3>
                <p style={{ color: '#64748b', fontSize: '0.875rem', lineHeight: 1.5, margin: 0 }}>
                  Personal facts and consultation records are handled strictly under the Philippine Data Privacy Act.
                </p>
              </div>

              <div style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1.75rem', color: '#004D40', marginBottom: '0.75rem' }}>
                  record_voice_over
                </span>
                <h3 style={{ fontSize: '1.05rem', color: '#0f172a', margin: '0 0 0.5rem' }}>Audio & Live Transcript</h3>
                <p style={{ color: '#64748b', fontSize: '0.875rem', lineHeight: 1.5, margin: 0 }}>
                  Encrypted WebRTC video with real-time browser transcription and session recording stored for your records.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-reveal" style={{ maxWidth: '1100px', margin: '0 auto 4rem', padding: '0 1.5rem' }}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '2rem' }}>
            <h2 style={{ fontFamily: 'Source Serif 4, Georgia, serif', fontSize: '1.4rem', color: '#0f172a', margin: '0 0 1rem' }}>
              Policy & Terms Summary
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              <div>
                <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>Pre-Guidance Disclaimer</strong>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.25rem 0 0.5rem', lineHeight: 1.5 }}>
                  The Ordinex system spots legal issues and cites relevant laws. It does not constitute formal legal representation.
                </p>
                <a href="/terms" style={{ fontSize: '0.85rem', color: '#004D40', fontWeight: 600 }}>Read Terms of Service →</a>
              </div>
              <div>
                <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>Data Protection (RA 10173)</strong>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.25rem 0 0.5rem', lineHeight: 1.5 }}>
                  Your uploaded documents and case descriptions are confidential and processed only to provide requested services.
                </p>
                <a href="/privacy" style={{ fontSize: '0.85rem', color: '#004D40', fontWeight: 600 }}>Read Privacy Policy →</a>
              </div>
              <div>
                <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>Open Source Licenses</strong>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.25rem 0 0.5rem', lineHeight: 1.5 }}>
                  Ordinex is built on open technologies and legal reference data under recognized open software licenses.
                </p>
                <a href="/licenses" style={{ fontSize: '0.85rem', color: '#004D40', fontWeight: 600 }}>View Licenses →</a>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="landing-section ui-section landing-reveal" style={{ maxWidth: '900px', margin: '0 auto 4rem', padding: '0 1.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <p style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.75rem', color: '#004D40', fontWeight: 700, margin: '0 0 0.5rem' }}>
              FAQ
            </p>
            <h2 style={{ fontFamily: 'Source Serif 4, Georgia, serif', fontSize: '1.85rem', color: '#0f172a', margin: '0 0 0.5rem' }}>
              Frequently Asked Questions
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0 }}>
              Straightforward answers about pre-guidance, consultations, and security.
            </p>
          </div>
          <div className="landing-faq">
            {FAQ_ITEMS.map((item) => (
              <details key={item.q} name="landing-faq" className="landing-faq__item">
                <summary>
                  <span>{item.q}</span>
                </summary>
                <p className="landing-faq__answer">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <LandingGovFooter />

      <AuthModal
        open={showAuth}
        onClose={() => {
          setShowAuth(false);
          setAuthInitialError('');
        }}
        initialView={authInitialView.current}
        initialTab={authInitialTab.current}
        initialError={authInitialError}
      />
    </div>
  );
};

export default LandingPage;
