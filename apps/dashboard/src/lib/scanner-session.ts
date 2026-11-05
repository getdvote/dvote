const SESSION_KEY = 'dvote-scanner-session';
const SECRET_KEY = 'dvote-pair-secret';

const store = <T>(read: () => T, fallback: T): T => {
  try {
    return read();
  } catch {
    return fallback; // private mode: nothing is remembered
  }
};

/** The paired phone's session, kept in this browser so closing the tab doesn't end it. */
export const scannerSession = {
  get: (): string | null => store(() => localStorage.getItem(SESSION_KEY), null),
  set: (token: string): void => store(() => localStorage.setItem(SESSION_KEY, token), undefined),
  clear: (): void => store(() => localStorage.removeItem(SESSION_KEY), undefined),
};

/**
 * The QR's secret, moved out of the address bar as soon as the page opens. It stays for this tab
 * only, so reloading before typing the code still works.
 */
export const pairSecret = {
  take(): string | null {
    const fromUrl = window.location.hash.slice(1);
    if (/^[0-9a-f]{32}$/.test(fromUrl)) {
      store(() => sessionStorage.setItem(SECRET_KEY, fromUrl), undefined);
      window.history.replaceState(null, '', window.location.pathname);
      return fromUrl;
    }
    return store(() => sessionStorage.getItem(SECRET_KEY), null);
  },
  clear: (): void => store(() => sessionStorage.removeItem(SECRET_KEY), undefined),
};

/** Egyptian phones often type Arabic digits, and a pasted code may have spaces. */
export function normalizeCode(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, '');
}

/** A short name for the Paired phones list. Never the full user agent. */
export function deviceLabel(userAgent: string): string {
  if (/iphone|ipad/i.test(userAgent)) return 'iPhone';
  if (/android/i.test(userAgent)) return 'Android';
  return 'Phone';
}
