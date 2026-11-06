import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ar } from './ar';
import { en, type Dictionary } from './en';

/**
 * Arabic (default, decided 2026-11-05) + English. The switch in the header is remembered in this
 * browser (localStorage). Arabic is right-to-left (index.html sets it before the first paint). Pages read their words from `d` (the current dictionary).
 */
export type Language = 'en' | 'ar';
const KEY = 'dvote-landing-language';
const dictionaries: Record<Language, Dictionary> = { en, ar };
const TITLES: Record<Language, string> = {
  ar: 'dvote · كروت الولاء في محفظة زباينك',
  en: "dvote · Loyalty cards in your customers' wallet",
};

function initial(): Language {
  try {
    if (localStorage.getItem(KEY) === 'en') return 'en';
  } catch {
    // storage blocked: the default
  }
  return 'ar';
}

function apply(lang: Language) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.title = TITLES[lang];
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
