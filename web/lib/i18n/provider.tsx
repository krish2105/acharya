'use client';

import { createContext, useCallback, useContext, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { dictionaries, type DictKey, type Locale } from './dictionaries';

interface I18nContextValue {
  locale: Locale;
  t: (key: DictKey) => string;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const router = useRouter();

  const t = useCallback(
    (key: DictKey) => dictionaries[locale][key] ?? dictionaries.en[key] ?? key,
    [locale],
  );

  const setLocale = useCallback(
    (next: Locale) => {
      document.cookie = `locale=${next}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    },
    [router],
  );

  const value = useMemo(() => ({ locale, t, setLocale }), [locale, t, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT must be used inside I18nProvider');
  return ctx;
}
