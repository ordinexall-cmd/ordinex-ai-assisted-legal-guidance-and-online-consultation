import React, { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly prompt: () => Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/** Soft dismiss only — banner returns after TTL when not installed. */
const DISMISS_KEY = 'ordinex_pwa_install_dismiss_until';
const LEGACY_SESSION_KEY = 'ordinex_pwa_install_dismissed';
const DISMISS_TTL_MS = 60 * 60 * 1000; // 1 hour

type PromptMode = 'android' | 'android-hint' | 'ios';

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mq = window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone =
    'standalone' in navigator
    && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return mq || iosStandalone;
}

function isMobileViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches;
}

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iPadOs13 =
    navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || iPadOs13;
}

function clearLegacyDismiss(): void {
  try {
    sessionStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function isSoftDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const until = Number(raw);
    if (!Number.isFinite(until) || Date.now() >= until) {
      localStorage.removeItem(DISMISS_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function setSoftDismiss(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_TTL_MS));
  } catch {
    /* ignore */
  }
}

function clearSoftDismiss(): void {
  try {
    localStorage.removeItem(DISMISS_KEY);
  } catch {
    /* ignore */
  }
}

export const InstallPrompt: React.FC = () => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<PromptMode | null>(null);
  const [visible, setVisible] = useState(false);

  const evaluate = useCallback(() => {
    clearLegacyDismiss();

    if (isStandalone()) {
      setVisible(false);
      setMode(null);
      setDeferred(null);
      clearSoftDismiss();
      return;
    }

    if (!isMobileViewport()) {
      setVisible(false);
      return;
    }

    if (isSoftDismissed()) {
      setVisible(false);
      return;
    }

    if (isIosDevice()) {
      setMode('ios');
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    evaluate();

    const onBip = (e: Event) => {
      e.preventDefault();
      if (isStandalone() || !isMobileViewport() || isSoftDismissed()) return;
      setDeferred(e as BeforeInstallPromptEvent);
      setMode('android');
      setVisible(true);
    };

    const onVis = () => {
      if (document.visibilityState === 'visible') evaluate();
    };

    window.addEventListener('beforeinstallprompt', onBip);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pageshow', onVis);

    const hintTimer = window.setTimeout(() => {
      if (isStandalone() || !isMobileViewport() || isSoftDismissed() || isIosDevice()) return;
      setMode((prev) => {
        if (prev === 'android') return prev;
        return 'android-hint';
      });
      setVisible(true);
    }, 1800);

    return () => {
      window.clearTimeout(hintTimer);
      window.removeEventListener('beforeinstallprompt', onBip);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pageshow', onVis);
    };
  }, [evaluate]);

  useEffect(() => {
    if (!visible) {
      document.body.classList.remove('pwa-install-visible');
      return undefined;
    }
    document.body.classList.add('pwa-install-visible');
    return () => document.body.classList.remove('pwa-install-visible');
  }, [visible]);

  if (!visible || !mode) return null;
  if (mode === 'android' && !deferred) return null;

  const dismiss = () => {
    setSoftDismiss();
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') {
      clearSoftDismiss();
      setVisible(false);
    } else {
      dismiss();
    }
    setDeferred(null);
  };

  const showIosSteps = mode === 'ios';
  const showAndroidHint = mode === 'android-hint';

  return (
    <div className="pwa-install" role="dialog" aria-label="Install Ordinex">
      <div className="pwa-install__head">
        <img
          src={`/icons/pwa-192.png?v=2`}
          alt=""
          className="pwa-install__icon"
          width={44}
          height={44}
        />
        <div className="pwa-install__copy">
          <strong>Install Ordinex</strong>
          {showIosSteps ? (
            <span>
              On iPhone there is no Install button. In <strong>Safari</strong>: tap Share,
              then <strong>Add to Home Screen</strong>.
            </span>
          ) : showAndroidHint ? (
            <span>
              Add Ordinex to your home screen. If you removed the icon, you can install again anytime.
            </span>
          ) : (
            <span>Add to your home screen for quick access. You can install again anytime if you remove the icon.</span>
          )}
        </div>
      </div>

      {showIosSteps ? (
        <ol className="pwa-install__steps">
          <li>Open this page in Safari (not Chrome)</li>
          <li>Tap the Share icon</li>
          <li>Tap Add to Home Screen → Add</li>
        </ol>
      ) : null}

      {showAndroidHint ? (
        <ol className="pwa-install__steps">
          <li>Open Chrome menu (⋮)</li>
          <li>Tap Install app or Add to Home screen</li>
        </ol>
      ) : null}

      <div
        className={`pwa-install__actions${mode === 'android' ? '' : ' pwa-install__actions--single'}`}
      >
        <button type="button" className="pwa-install__btn pwa-install__btn--ghost" onClick={dismiss}>
          Not now
        </button>
        {mode === 'android' ? (
          <button
            type="button"
            className="pwa-install__btn pwa-install__btn--primary"
            onClick={() => void install()}
          >
            Install
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default InstallPrompt;
