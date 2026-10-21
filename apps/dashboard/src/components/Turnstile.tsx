import { useEffect, useRef } from 'react';
import { useI18n } from '../i18n';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
      reset: (id: string) => void;
    };
  }
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading: Promise<void> | null = null;
const loadScript = () =>
  (loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('captcha script failed to load'));
    document.head.appendChild(s);
  }));

/**
 * Cloudflare Turnstile captcha (merchant sign-up). Calls onToken with a fresh token, or null when
 * it expires. `resetKey` changes → a new challenge (after a failed submit: tokens are single use).
 */
export function Turnstile({ siteKey, onToken, resetKey }: { siteKey: string; onToken: (t: string | null) => void; resetKey: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const idRef = useRef<string | null>(null);
  const { language } = useI18n();

  useEffect(() => {
    let cancelled = false;
    void loadScript().then(() => {
      if (cancelled || !ref.current || !window.turnstile) return;
      idRef.current = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        language,
        callback: (token: string) => onToken(token),
        'expired-callback': () => onToken(null),
        'error-callback': () => onToken(null),
      });
    });
    return () => {
      cancelled = true;
      if (idRef.current && window.turnstile) window.turnstile.remove(idRef.current);
      idRef.current = null;
    };
  }, [siteKey, language, onToken]);

  useEffect(() => {
    if (resetKey && idRef.current && window.turnstile) {
      window.turnstile.reset(idRef.current);
      onToken(null);
    }
  }, [resetKey, onToken]);

  return <div ref={ref} className="min-h-[65px]" />;
}
