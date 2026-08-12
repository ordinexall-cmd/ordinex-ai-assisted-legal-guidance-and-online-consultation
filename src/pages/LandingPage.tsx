import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { MarketingNav } from '../components/shell/MarketingNav';
import { LandingBenefitChips } from '../components/landing/LandingBenefitChips';
import { LandingAmbientLights } from '../components/landing/LandingAmbientLights';
import { LandingHeroBackground } from '../components/landing/LandingHeroBackground';
import { LandingHeroCallout } from '../components/landing/LandingHeroCallout';
import { LandingHeroProductDemo } from '../components/landing/LandingHeroProductDemo';
import { LandingGovFooter } from '../components/landing/LandingGovFooter';
import { AuthModal, type AuthView } from '../components/auth/AuthModal';

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: 'Is this legal advice?',
    a: 'No. Ordinex is a tool to organize your facts and see a structured plain-language read. A licensed lawyer still signs off on anything that matters.',
  },
  {
    q: 'What does one analysis run actually produce?',
    a: 'A draft-style outline: issues in plain language (not court tone), pointers to relevant statute areas to read next, suggested questions for counsel, and flags where your facts are thin before you pay a lawyer. It is not a court filing, demand letter, or signed opinion.',
  },
  {
    q: 'Can I try it without signing up?',
    a: 'Yes. On the home page you can type a short situation and get a one-line preview for straightforward matters. Create a free account when you want a full analysis, follow-up questions, or to book a lawyer.',
  },
  {
    q: 'What do I get when I sign up?',
    a: 'A free citizen account unlocks full AI case analysis (including complex matters), saved history, the lawyer directory, scheduling, and video consults. We ask for consent at signup because the Data Privacy Act (RA 10173) applies to legal tech.',
  },
  {
    q: 'How does payment work?',
    a: 'Ordinex does not charge a monthly platform fee. When you book a lawyer, they quote a fee after reviewing your case; you pay that quote through Ordinex checkout (GCash via PayMongo). Ordinex deducts a 10% platform fee from the lawyer\'s share.',
  },
  {
    q: 'Will the AI get everything right?',
    a: 'No model does. Treat the result like rough notes for a consult. If the stakes are high, pay for counsel and use the draft to brief them faster.',
  },
  {
    q: 'What happens to what I type?',
    a: 'We ask for consent at signup because the Data Privacy Act applies. We only collect what the product needs for accounts, analysis, and bookings; details are in the policy screens inside the app.',
  },
  {
    q: 'Who can see my matter text?',
    a: 'Your account data and analysis inputs are handled for running the service — not published on the marketing site. Lawyers only see what you send through directory or booking flows you start. Use the in-app privacy and security settings for the fine print.',
  },
  {
    q: 'How does the lawyer directory work?',
    a: 'After you sign in, browse verified private lawyers, view their fees, and book a slot. Ordinex does not verify bar standing for you — check IBP and credentials yourself before you hire.',
  },
];

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  google_not_configured: 'Google sign-in is not configured on this server.',
  missing_code: 'Google sign-in was cancelled or incomplete. Please try again.',
  no_email: 'Your Google account did not share an email address.',
  missing_token: 'Sign-in link expired. Please try again.',
  session_failed: 'Your session could not be loaded. Please sign in again.',
  account_suspended: 'Your account has been suspended.',
  google_failed: 'Google sign-in failed. Please try again.',
  role_mismatch: 'This email is registered under a different account type. Use the correct sign-in option.',
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
    setAuthInitialError(AUTH_ERROR_MESSAGES[code] || 'Sign-in failed. Please try again.');
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
          Your counsel verification is complete. Sign in with your email and password to open your dashboard.
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

        <LandingBenefitChips />

        <section id="experience" className="landing-section landing-anchor-target ui-section">
          <div className="landing-section__header landing-reveal">
            <p className="landing-section__eyebrow">How it works</p>
            <h2 className="landing-section__title">Three plain steps</h2>
            <p className="landing-section__subtitle">No jargon required. Add files only if they change the story.</p>
          </div>
          <div className="landing-grid-3 landing-reveal">
            {[
              {
                step: '01',
                title: 'Say it in your own words',
                desc: 'Type the facts as you would tell a friend. Messy or long is fine.',
              },
              {
                step: '02',
                title: 'Read a structured draft',
                desc: 'Issues, statute breadcrumbs, risks, and questions you can paste into a consult note.',
              },
              {
                step: '03',
                title: 'Book counsel when it feels right',
                desc: 'Browse lawyers, see their fees, and pay at booking time — no platform subscription.',
              },
            ].map((item, index) => (
              <div
                key={item.step}
                className={`landing-step-card landing-step-card--${index + 1}`}
              >
                <span className="landing-step-card__num" aria-hidden>{item.step}</span>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </div>
            ))}
          </div>
          <p className="landing-section__try-hint landing-reveal">
            Try it above — type your situation for a free preview line.
          </p>
          <div className="landing-cta-row landing-reveal">
            <div className="landing-cta-row__copy">
              <h2 className="landing-cta-row__title">Ready when you are</h2>
              <p className="landing-cta-row__text">
                Create a free account for full analysis, saved history, and lawyer booking.
              </p>
            </div>
            <button
              type="button"
              className="ox-btn ox-btn-primary ox-btn-lg landing-cta-row__btn"
              onClick={() => openAuth('register')}
            >
              Create free account
            </button>
          </div>
        </section>

        <section id="faq" className="landing-section landing-anchor-target ui-section">
          <div className="landing-section__header landing-reveal">
            <p className="landing-section__eyebrow">FAQ</p>
            <h2 className="landing-section__title">Straight questions</h2>
            <p className="landing-section__subtitle">
              If money or liberty is on the line, stop reading marketing copy and call counsel.
            </p>
          </div>
          <div className="landing-faq landing-reveal">
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
