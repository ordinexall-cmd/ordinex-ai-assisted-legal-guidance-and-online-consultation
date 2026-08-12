import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const STORAGE_KEY = 'ordinex.sidenav.expanded';

interface SideNavContextValue {
  readonly expanded: boolean;
  readonly toggle: () => void;
  readonly setExpanded: (value: boolean) => void;
}

const SideNavContext = createContext<SideNavContextValue | null>(null);

function readExpanded(): boolean {
  try {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches) {
      return false;
    }
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'false') return false;
    if (v === 'true') return true;
  } catch {
    /* ignore */
  }
  return true;
}

export function SideNavProvider({ children }: { children: React.ReactNode }) {
  const [expanded, setExpandedState] = useState(readExpanded);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    const onChange = () => {
      if (mq.matches) setExpandedState(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.sidenavExpanded = expanded ? 'true' : 'false';
    try {
      localStorage.setItem(STORAGE_KEY, String(expanded));
    } catch {
      /* ignore */
    }
  }, [expanded]);

  const setExpanded = useCallback((value: boolean) => {
    setExpandedState(value);
  }, []);

  const toggle = useCallback(() => {
    setExpandedState((prev) => !prev);
  }, []);

  const value = useMemo(
    () => ({ expanded, toggle, setExpanded }),
    [expanded, toggle, setExpanded],
  );

  return (
    <SideNavContext.Provider value={value}>
      {children}
    </SideNavContext.Provider>
  );
}

export function useSideNav(): SideNavContextValue {
  const ctx = useContext(SideNavContext);
  if (!ctx) {
    throw new Error('useSideNav must be used within SideNavProvider');
  }
  return ctx;
}
