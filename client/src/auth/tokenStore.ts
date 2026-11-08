// The session token lives in sessionStorage: it is cleared when the tab closes (contract F-01 section 2).
// Storage can throw (private windows, blocked site data), so every access is guarded.
const KEY = 'lendlab.token';

export function getToken(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    sessionStorage.setItem(KEY, token);
  } catch {
    /* the session then lasts until the page reloads */
  }
}

export function clearToken(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}
