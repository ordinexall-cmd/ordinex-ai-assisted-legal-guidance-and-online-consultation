import React, { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../brand/BrandLogo';

const NAV_ANCHORS = [
  { href: '/#experience', label: 'How it works' },
  { href: '/#faq', label: 'FAQ' },
] as const;

export type MarketingNavAuthActions = 'both' | 'signin-only';

interface MarketingNavProps {
  readonly onSignIn?: () => void;
  readonly onGetStarted?: () => void;
  readonly variant?: 'light' | 'dark';
  /** Default `both`. Landing uses `signin-only` (Create account lives in hero). */
  readonly authActions?: MarketingNavAuthActions;
}

export const MarketingNav: React.FC<MarketingNavProps> = ({
  onSignIn,
  onGetStarted,
  variant = 'light',
  authActions = 'both',
}) => {
  const logoVariant = variant === 'dark' ? 'onDark' : 'onLight';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const first = panelRef.current?.querySelector<HTMLElement>(
      'a, button:not([disabled])',
    );
    first?.focus();
  }, [menuOpen]);

  const closeMenu = () => {
    setMenuOpen(false);
    menuButtonRef.current?.focus();
  };

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {NAV_ANCHORS.map((a) => (
        <a
          key={a.href}
          href={a.href}
          className="marketing-nav__link"
          onClick={onNavigate}
        >
          {a.label}
        </a>
      ))}
    </>
  );

  return (
    <nav className={`marketing-nav marketing-nav--${variant}`} aria-label="Main">
      <Link to="/" className="marketing-nav__brand" onClick={closeMenu}>
        <BrandLogo size="md" variant={logoVariant} />
      </Link>

      <div className="marketing-nav__links marketing-nav__links--desktop">
        <NavLinks />
      </div>

      <div className="marketing-nav__actions marketing-nav__actions--desktop">
        {onSignIn && (
          <button
            type="button"
            className="marketing-btn marketing-btn-secondary marketing-btn-sm"
            onClick={onSignIn}
          >
            Log in
          </button>
        )}
        {authActions === 'both' && onGetStarted && (
          <button
            type="button"
            className="marketing-btn marketing-btn-primary marketing-btn-sm"
            onClick={onGetStarted}
          >
            Get started
          </button>
        )}
      </div>

      <button
        ref={menuButtonRef}
        type="button"
        className={`marketing-nav__menu-btn ox-tap-target${menuOpen ? ' is-open' : ''}`}
        aria-expanded={menuOpen}
        aria-controls={menuId}
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        onClick={() => setMenuOpen((o) => !o)}
      >
        <span className="marketing-nav__burger" aria-hidden>
          <span />
          <span />
        </span>
        <span className="marketing-nav__menu-label">{menuOpen ? 'Close' : 'Menu'}</span>
      </button>

      {menuOpen && (
        <>
          <button
            type="button"
            className="marketing-nav__backdrop"
            aria-label="Close menu"
            onClick={closeMenu}
          />
          <div
            ref={panelRef}
            id={menuId}
            className="marketing-nav__drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
          >
            <div className="marketing-nav__drawer-links">
              <NavLinks onNavigate={closeMenu} />
              <Link to="/privacy" className="marketing-nav__link" onClick={closeMenu}>
                Privacy
              </Link>
              <Link to="/terms" className="marketing-nav__link" onClick={closeMenu}>
                Terms
              </Link>
            </div>
            <div className="marketing-nav__drawer-actions">
              {onSignIn && (
                <button
                  type="button"
                  className="marketing-btn marketing-btn-secondary marketing-btn-sm ox-tap-target"
                  onClick={() => {
                    closeMenu();
                    onSignIn();
                  }}
                >
                  Log in
                </button>
              )}
              {authActions === 'both' && onGetStarted && (
                <button
                  type="button"
                  className="marketing-btn marketing-btn-primary marketing-btn-sm ox-tap-target"
                  onClick={() => {
                    closeMenu();
                    onGetStarted();
                  }}
                >
                  Get started
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </nav>
  );
};

export default MarketingNav;
