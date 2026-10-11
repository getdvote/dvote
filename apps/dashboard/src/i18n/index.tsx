import { Direction } from 'radix-ui';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ar } from './ar';
import { en, type Dictionary, type PluralForms } from './en';

/**
 * Dashboard languages, like the customer app: English is the default, Arabic the other one.
 * The choice is saved in this browser (localStorage) and applied before the first paint
 * (index.html), so Arabic pages never flash left-to-right.
 *
 *   const { t } = useI18n();
 *   t('nav.overview')                    → "Overview" / "نظرة عامة"
 *   t('common.items', { count: 3 })      → plural forms per language
 *
 * Code outside components (toasts in mutations, API errors) uses the plain `t` exported here.
 * Admin-only pages stay in English for now; the merchant pages and the shared tabs are translated.
 */
export type Language = 'en' | 'ar';

export const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
];

const STORAGE_KEY = 'dvote-dashboard-language';
const dictionaries: Record<Language, Dictionary> = { en, ar };

function savedLanguage(): Language {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en';
  }
}

// Arabic month and weekday names, but Western digits (0-9) like the customer app.
const arLocale = dayjs.Ls.ar;
dayjs.locale({ ...arLocale, name: 'ar-latn', preparse: (s: string) => s, postformat: (s: string) => s } as typeof arLocale, undefined, true);

let current: Language = savedLanguage();

export const getLanguage = () => current;
export function isRtl(language: Language = current) {
  return language === 'ar';
}
/** Locale for Intl / toLocaleString: Arabic (Egypt) with Western digits. */
export const localeOf = (language: Language = current) => (language === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB');

type Paths<T> = {
  [K in keyof T & string]: T[K] extends string | PluralForms ? K : `${K}.${Paths<T[K]>}`;
}[keyof T & string];
export type TKey = Paths<Dictionary>;
export type TParams = Record<string, string | number>;

function lookup(dict: Dictionary, key: string): string | PluralForms | undefined {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' || (node && typeof node === 'object' && 'other' in node) ? (node as string | PluralForms) : undefined;
}

/** CLDR plural categories (Arabic has six). */
function pluralCategory(language: Language, n: number): keyof PluralForms {
  if (language === 'en') return n === 1 ? 'one' : 'other';
  const mod100 = n % 100;
  if (n === 0) return 'zero';
  if (n === 1) return 'one';
  if (n === 2) return 'two';
  if (mod100 >= 3 && mod100 <= 10) return 'few';
  if (mod100 >= 11 && mod100 <= 99) return 'many';
  return 'other';
}

const formatParam = (v: string | number) => (typeof v === 'number' ? v.toLocaleString('en-US') : v);

/** Translate with the current language. `{name}` placeholders are filled from params. */
export function t(key: TKey, params?: TParams): string {
  let value = lookup(dictionaries[current], key) ?? lookup(en, key) ?? key;
  if (typeof value === 'object') {
    const count = Number(params?.count ?? 0);
    value = value[pluralCategory(current, count)] ?? value.other;
  }
  return params ? value.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? formatParam(params[name]) : m)) : value;
}

/** Text for an API error code, if the dictionary has one. */
export function errorText(code: string): string | undefined {
  const v = lookup(dictionaries[current], `errors.${code}`);
  return typeof v === 'string' ? v : undefined;
}

/** Merchant data typed in two languages (reward names…): the Arabic one in Arabic when set. */
export function localized(english: string, arabic: string | null | undefined): string;
export function localized(english: string | null, arabic: string | null | undefined): string | null;
export function localized(english: string | null, arabic: string | null | undefined): string | null {
  return current === 'ar' && arabic?.trim() ? arabic : english;
}

applyToDocument(current);

function applyToDocument(language: Language) {
  document.documentElement.lang = language;
  document.documentElement.dir = isRtl(language) ? 'rtl' : 'ltr';
  dayjs.locale(language === 'ar' ? 'ar-latn' : 'en');
}

interface I18nState {
  language: Language;
  rtl: boolean;
  locale: string;
  t: typeof t;
  /** persist = false: just for this page view (e.g. admin pages, which are English only). */
  setLanguage: (language: Language, persist?: boolean) => void;
}

const I18nContext = createContext<I18nState | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setState] = useState<Language>(current);

  const setLanguage = useCallback((lang: Language, persist = true) => {
    current = lang;
    applyToDocument(lang);
    setState(lang);
    if (!persist) return;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // private mode: the choice lasts until the tab closes
    }
  }, []);

  const value = useMemo<I18nState>(
    () => ({
      language,
      rtl: isRtl(language),
      locale: localeOf(language),
      // a new function per language, so memoised children re-render on a switch
      t: (key: TKey, params?: TParams) => t(key, params),
      setLanguage,
    }),
    [language, setLanguage],
  );

  return (
    <I18nContext.Provider value={value}>
      {/* Radix menus, tabs and toggles follow the reading direction too. */}
      <Direction.Provider dir={value.rtl ? "rtl" : "ltr"}>
        {/* Remount on a switch, so text read with the plain t() updates too (queries stay cached). */}
        <LanguageRoot key={language}>{children}</LanguageRoot>
      </Direction.Provider>
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nState {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}

function LanguageRoot({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/** Admin pages are English only: show them left-to-right in English without changing the saved choice. */
export function useEnglishOnly() {
  const { language, setLanguage } = useI18n();
  useEffect(() => {
    if (language !== 'en') setLanguage('en', false);
  }, [language, setLanguage]);
}
