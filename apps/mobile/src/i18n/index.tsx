import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { ar } from './ar';
import { en, type Dictionary, type PluralForms } from './en';

/**
 * App languages. English is the default; the choice (Settings → Language) is saved on the
 * device. Arabic switches the whole layout to right-to-left at once (no restart): `Screen`,
 * the tab bar and the sheets set `direction` from `useI18n().rtl`.
 *
 *   const { t } = useI18n();
 *   t('cards.title')                       → "My cards" / "بطاقاتي"
 *   t('cards.shops', { count: 3 })         → "3 shops" / "٣ متاجر" (plural forms per language)
 *
 * Code outside components (API error messages, dialogs) uses the plain `t` exported here,
 * which reads the current language.
 */
export type Language = 'en' | 'ar';

export const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
];

export const DEFAULT_LANGUAGE: Language = 'en';
const STORAGE_KEY = 'dvote.language';
const dictionaries: Record<Language, Dictionary> = { en, ar };

let current: Language = DEFAULT_LANGUAGE;

export const getLanguage = () => current;
export const isRtl = (language: Language = current) => language === 'ar';
/** BCP 47 locale for dates and numbers: Arabic as written in Egypt (Western digits kept below). */
export const localeOf = (language: Language = current) => (language === 'ar' ? 'ar-EG' : 'en-GB');

/** Every key of the dictionary, e.g. "cards.title". */
type Paths<T> = {
  [K in keyof T & string]: T[K] extends readonly unknown[]
    ? never // lists (month names…) are read with calendarNames()
    : T[K] extends string | PluralForms
      ? K
      : `${K}.${Paths<T[K]>}`;
}[keyof T & string];
export type TKey = Paths<Dictionary>;
export type TParams = Record<string, string | number>;

function lookup(dict: Dictionary, key: string): string | PluralForms | undefined {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' || (node && typeof node === 'object' && 'other' in node)
    ? (node as string | PluralForms)
    : undefined;
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

/** Numbers stay in Western digits (0-9), as Egyptian apps and receipts use them. */
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

/** Text for an API error code, if the dictionary has one (codes come from the server). */
export function errorText(code: string): string | undefined {
  const v = lookup(dictionaries[current], `errors.${code}`) ?? lookup(en, `errors.${code}`);
  return typeof v === 'string' ? v : undefined;
}

/** Month and weekday names in the current language. */
export const calendarNames = () => dictionaries[current].calendar;

interface I18nState {
  language: Language;
  rtl: boolean;
  locale: string;
  t: typeof t;
  setLanguage: (language: Language) => Promise<void>;
}

const I18nContext = createContext<I18nState | null>(null);

function applyToWeb(language: Language) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  document.documentElement.lang = language;
  document.documentElement.dir = isRtl(language) ? 'rtl' : 'ltr';
}

/** Loads the saved language before showing the app (so it never flashes in English first). */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setState] = useState<Language | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .catch(() => null)
      .then((saved) => {
        const lang: Language = saved === 'ar' || saved === 'en' ? saved : DEFAULT_LANGUAGE;
        current = lang;
        applyToWeb(lang);
        setState(lang);
      });
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    current = lang;
    applyToWeb(lang);
    setState(lang);
    await AsyncStorage.setItem(STORAGE_KEY, lang).catch(() => undefined);
  }, []);

  const value = useMemo<I18nState | null>(
    () =>
      language
        ? {
            language,
            rtl: isRtl(language),
            locale: localeOf(language),
            // a new function per language, so memoised children re-render on a switch
            t: (key: TKey, params?: TParams) => t(key, params),
            setLanguage,
          }
        : null,
    [language, setLanguage],
  );

  if (!value) return null;
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nState {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
