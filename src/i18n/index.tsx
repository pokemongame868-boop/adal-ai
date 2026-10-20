import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ru, type Dict } from './ru';
import { kk } from './kk';

export type UILang = 'ru' | 'kk';
const DICTS: Record<UILang, Dict> = { ru, kk };
const STORAGE_KEY = 'adal.lang';

interface I18nValue {
  lang: UILang;
  t: Dict;
  setLang: (l: UILang) => void;
  f: (template: string, vars: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function initialLang(): UILang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ru' || saved === 'kk') return saved;
  } catch {
    /* storage unavailable */
  }
  return 'ru';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<UILang>(initialLang);

  const setLang = useCallback((l: UILang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l); // only the UI language preference is stored
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === 'kk' ? 'kk' : 'ru';
    document.title = `ADAL AI — ${DICTS[lang].brand.tagline}`;
  }, [lang]);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      t: DICTS[lang],
      setLang,
      f: (template, vars) => template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? '')),
    }),
    [lang, setLang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
