import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';

export const SUPPORTED_LANGUAGES = ['ar', 'en', 'fr', 'es', 'de', 'zh', 'ru'] as const;
export type Language = typeof SUPPORTED_LANGUAGES[number];

interface I18nContextValue {
  lang: Language;
  dir: 'ltr' | 'rtl';
  ready: boolean;
  setLanguage: (lang: Language) => void;
  toggleLang: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

const FALLBACK_LANGUAGE: Language = 'ar';
const cache: Partial<Record<Language, Record<string, string>>> = {};

function flatten(input: Record<string, unknown>, prefix = '', out: Record<string, string> = {}) {
  Object.entries(input).forEach(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[path] = value;
    else if (value && typeof value === 'object') flatten(value as Record<string, unknown>, path, out);
  });
  return out;
}

async function loadLanguage(lang: Language) {
  if (cache[lang]) return cache[lang]!;
  const response = await fetch(`/locales/${lang}/translation.json`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to load locale ${lang}`);
  const data = await response.json() as Record<string, unknown>;
  cache[lang] = flatten(data);
  return cache[lang]!;
}

function interpolate(value: string, options?: Record<string, unknown>) {
  if (!options) return value;
  return value.replace(/{{\s*([^}]+)\s*}}/g, (_, key) => String(options[key] ?? ''));
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>(() => {
    const stored = localStorage.getItem('lang') as Language | null;
    return stored && SUPPORTED_LANGUAGES.includes(stored) ? stored : FALLBACK_LANGUAGE;
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('lang', lang);
    (async () => {
      try {
        await loadLanguage(FALLBACK_LANGUAGE);
        if (lang !== FALLBACK_LANGUAGE) await loadLanguage(lang);
      } catch (error) {
        console.error('i18n locale loading failed; using fallback:', error);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [lang]);

  const value = useMemo<I18nContextValue>(() => {
    const current = cache[lang] ?? {};
    const fallback = cache[FALLBACK_LANGUAGE] ?? {};
    const t = (key: string, options?: Record<string, unknown>) => {
      const raw = current[key] ?? fallback[key] ?? key;
      return interpolate(raw, options);
    };
    return {
      lang,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      ready,
      setLanguage: setLang,
      toggleLang: () => {
        const index = SUPPORTED_LANGUAGES.indexOf(lang);
        setLang(SUPPORTED_LANGUAGES[(index + 1) % SUPPORTED_LANGUAGES.length]);
      },
      t,
    };
  }, [lang, ready]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
