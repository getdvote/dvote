import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ar } from './ar';
import { en, type Dictionary } from './en';

/**
 * English (default) + Arabic. The first visit follows the browser's language; the switch in the
 * header is remembered in this browser (localStorage). Arabic is right-to-left (index.html sets it
 * before the first paint). Pages read their words from `d` (the current dictionary).
 */
export type Language = 'en' | 'ar';
const KEY = 'dvote-landing-language';
const dictionaries: Record<Language, Dictionary> = { en, ar };

function initial(): Language {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'ar' || saved === 'en') return saved;
  } catch {
    // storage blocked: follow the browser
  }
  return navigator.language.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

function apply(lang: Language) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

/** `{name}` placeholders. */
export const fill = (text: string, params: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));

const Ctx = createContext<{ language: Language; d: Dictionary; setLanguage: (l: Language) => void } | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setState] = useState<Language>(() => {
    const l = initial();
    apply(l);
    return l;
  });
  const setLanguage = useCallback((l: Language) => {
    apply(l);
    setState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      // not saved: fine
    }
  }, []);
  const value = useMemo(() => ({ language, d: dictionaries[language], setLanguage }), [language, setLanguage]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside I18nProvider');
  return v;
}
