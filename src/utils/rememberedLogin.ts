/** Device-local login recall for the Auth modal (opt-in, multi-account). */

const STORAGE_KEY = 'ordinex_remembered_login';
const MAX_ACCOUNTS = 10;

export type RememberedLogin = {
  email: string;
  password: string;
  tab: 'citizen' | 'lawyer';
};

export type RememberedLoginStore = {
  accounts: RememberedLogin[];
  lastEmail?: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function parseAccount(raw: Partial<RememberedLogin> | null | undefined): RememberedLogin | null {
  if (!raw || typeof raw !== 'object') return null;
  const email = typeof raw.email === 'string' ? raw.email.trim() : '';
  const password = typeof raw.password === 'string' ? raw.password : '';
  const tab = raw.tab === 'lawyer' ? 'lawyer' : 'citizen';
  if (!email || !password) return null;
  return { email, password, tab };
}

/** Migrate legacy single-object storage into the multi-account shape. */
function parseStore(raw: string | null): RememberedLoginStore {
  if (!raw) return { accounts: [] };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (Array.isArray(parsed.accounts)) {
      const accounts = parsed.accounts
        .map((a) => parseAccount(a as Partial<RememberedLogin>))
        .filter((a): a is RememberedLogin => Boolean(a));
      const lastEmail = typeof parsed.lastEmail === 'string' ? parsed.lastEmail.trim() : undefined;
      return { accounts, lastEmail: lastEmail || undefined };
    }
    const single = parseAccount(parsed as Partial<RememberedLogin>);
    if (single) return { accounts: [single], lastEmail: single.email };
    return { accounts: [] };
  } catch {
    return { accounts: [] };
  }
}

function writeStore(store: RememberedLoginStore): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      accounts: store.accounts.map((a) => ({
        email: a.email.trim(),
        password: a.password,
        tab: a.tab,
      })),
      lastEmail: store.lastEmail || undefined,
    }),
  );
}

export function loadRememberedAccounts(): RememberedLoginStore {
  try {
    return parseStore(localStorage.getItem(STORAGE_KEY));
  } catch {
    return { accounts: [] };
  }
}

/** Most recently used (or only) saved login — for default autofill. */
export function loadRememberedLogin(): RememberedLogin | null {
  const store = loadRememberedAccounts();
  if (!store.accounts.length) return null;
  if (store.lastEmail) {
    const match = store.accounts.find(
      (a) => normalizeEmail(a.email) === normalizeEmail(store.lastEmail!),
    );
    if (match) return match;
  }
  return store.accounts[0];
}

export function upsertRememberedLogin(data: RememberedLogin): void {
  const email = data.email.trim();
  const password = data.password;
  const tab = data.tab === 'lawyer' ? 'lawyer' : 'citizen';
  if (!email || !password) return;

  const store = loadRememberedAccounts();
  const key = normalizeEmail(email);
  const without = store.accounts.filter((a) => normalizeEmail(a.email) !== key);
  const next: RememberedLogin = { email, password, tab };
  const accounts = [next, ...without].slice(0, MAX_ACCOUNTS);
  writeStore({ accounts, lastEmail: email });
}

/** @deprecated Prefer upsertRememberedLogin — kept for older call sites. */
export function saveRememberedLogin(data: RememberedLogin): void {
  upsertRememberedLogin(data);
}

export function removeRememberedLogin(email: string): void {
  const store = loadRememberedAccounts();
  const key = normalizeEmail(email);
  const accounts = store.accounts.filter((a) => normalizeEmail(a.email) !== key);
  const lastEmail =
    store.lastEmail && normalizeEmail(store.lastEmail) === key
      ? accounts[0]?.email
      : store.lastEmail;
  if (accounts.length === 0) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  writeStore({ accounts, lastEmail });
}

export function clearRememberedLogins(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** @deprecated Prefer clearRememberedLogins. */
export function clearRememberedLogin(): void {
  clearRememberedLogins();
}
