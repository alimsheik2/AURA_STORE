import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { PRELOADED_LOCALES } from '@/locales/all';

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

const DEFAULT_LANGUAGE: Language = 'ar';

function interpolate(value: string, options?: Record<string, unknown>) {
  if (!options) return value;
  return value.replace(/{{\s*([^}]+)\s*}}/g, (_, key) => String(options[key] ?? ''));
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>(() => {
    const stored = localStorage.getItem('lang') as Language | null;
    return stored && SUPPORTED_LANGUAGES.includes(stored) ? stored : DEFAULT_LANGUAGE;
  });

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('lang', lang);
  }, [lang]);

  const value = useMemo<I18nContextValue>(() => {
    const currentDict = PRELOADED_LOCALES[lang] || {};
    const enFallback = PRELOADED_LOCALES['en'] || {};
    const arFallback = PRELOADED_LOCALES['ar'] || {};

    const t = (key: string, options?: Record<string, unknown>) => {
      const raw = currentDict[key] ?? enFallback[key] ?? arFallback[key] ?? key;
      return interpolate(raw, options);
    };

    return {
      lang,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      ready: true,
      setLanguage: setLang,
      toggleLang: () => {
        const index = SUPPORTED_LANGUAGES.indexOf(lang);
        setLang(SUPPORTED_LANGUAGES[(index + 1) % SUPPORTED_LANGUAGES.length]);
      },
      t,
    };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

