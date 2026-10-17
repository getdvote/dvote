import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ar } from './ar';
import { en, type Dictionary, type PluralForms } from './en';

/**
 * English (default) + Arabic, like the dashboard and the customer app. The first visit follows
 * the phone's language; the switch in the footer is remembered in this browser. Arabic is
 * right-to-left (index.html sets it before the first paint). Switching remounts the page, so
 * the plain `t()` is fine anywhere.
 */
export type Language = 'en' | 'ar';
const KEY = 'dvote-web-language';
const dictionaries: Record<Language, Dictionary> = { en, ar };

function initial(): Language {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'ar' || saved === 'en') return saved;
  } catch {
    // storage blocked: follow the phone
  }
  return navigator.language.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

let current: Language = initial();
apply(current);

function apply(lang: Language) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

export const getLanguage = () => current;

type Paths<T> = { [K in keyof T & string]: T[K] extends string | PluralForms ? K : `${K}.${Paths<T[K]>}` }[keyof T & string];
export type TKey = Paths<Dictionary>;
type Params = Record<string, string | number>;

function lookup(dict: Dictionary, key: string): string | PluralForms | undefined {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' || (node && typeof node === 'object' && 'other' in node) ? (node as string | PluralForms) : undefined;
}

function plural(lang: Language, n: number): keyof PluralForms {
  if (lang === 'en') return n === 1 ? 'one' : 'other';
  const m = n % 100;
  if (n === 0) return 'zero';
  if (n === 1) return 'one';
  if (n === 2) return 'two';
  if (m >= 3 && m <= 10) return 'few';
  if (m >= 11 && m <= 99) return 'many';
  return 'other';
}

/** Translate; `{name}` placeholders come from params, plurals pick by `count`. */
export function t(key: TKey, params?: Params): string {
  let v = lookup(dictionaries[current], key) ?? lookup(en, key) ?? key;
  if (typeof v === 'object') v = v[plural(current, Number(params?.count ?? 0))] ?? v.other;
  return params ? v.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? (typeof params[k] === 'number' ? params[k].toLocaleString('en-US') : String(params[k])) : m)) : v;
}

export function errorText(code: string): string | undefined {
  const v = lookup(dictionaries[current], `errors.${code}`);
  return typeof v === 'string' ? v : undefined;
}

/** Merchant text typed in two languages: the Arabic one in Arabic when set. */
export const localized = (english: string, arabic: string | null | undefined) => (current === 'ar' && arabic?.trim() ? arabic : english);

const Ctx = createContext<{ language: Language; setLanguage: (l: Language) => void } | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setState] = useState<Language>(current);
  const setLanguage = useCallback((l: Language) => {
    current = l;
    apply(l);
    setState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      // not remembered
    }
  }, []);
  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);
  return (
    <Ctx.Provider value={value}>
      <Remount key={language}>{children}</Remount>
    </Ctx.Provider>
  );
}

function Remount({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useI18n() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useI18n outside I18nProvider');
  return c;
}
