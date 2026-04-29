'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

// Supported locale codes
export type Locale = 'en' | 'si' | 'ta';

export interface LocaleOption {
  code: Locale;
  name: string;
  nativeName: string;
  flag: string;
}

export const LOCALES: LocaleOption[] = [
  { code: 'en', name: 'English',  nativeName: 'English',  flag: '🇬🇧' },
  { code: 'si', name: 'Sinhala',  nativeName: 'සිංහල',    flag: '🇱🇰' },
  { code: 'ta', name: 'Tamil',    nativeName: 'தமிழ்',    flag: '🇱🇰' },
];

// ── i18n message store ──────────────────────────────────────────────────────
// Lazy-loads message JSON files on demand and caches them in memory.
const messageCache: Record<string, Record<string, unknown>> = {};

async function loadMessages(locale: Locale) {
  if (messageCache[locale]) return messageCache[locale];
  try {
    const msgs = await import(`@/messages/${locale}.json`);
    messageCache[locale] = msgs.default;
    return msgs.default as Record<string, unknown>;
  } catch {
    // Fall back to English
    if (locale !== 'en') return loadMessages('en');
    return {};
  }
}

// ── t() helper — resolves dotted key paths like "nav.dashboard" ─────────────
function resolveDotPath(obj: Record<string, unknown>, path: string): string {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return path; // key not found → return raw key as fallback
    }
  }
  return typeof cur === 'string' ? cur : path;
}

// ── Context ─────────────────────────────────────────────────────────────────
interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale, persist?: boolean) => Promise<void>;
  t: (key: string, vars?: Record<string, string | number>) => string;
  loading: boolean;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: 'en',
  setLocale: async () => {},
  t: (k) => k,
  loading: true,
});

// ── Provider ─────────────────────────────────────────────────────────────────
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [messages, setMessages] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);

  // Initialise from localStorage (persisted preference)
  useEffect(() => {
    const stored = (localStorage.getItem('dashboard_language') ?? 'en') as Locale;
    const supported: Locale[] = ['en', 'si', 'ta'];
    const init = supported.includes(stored) ? stored : 'en';
    loadMessages(init).then((msgs) => {
      setLocaleState(init);
      setMessages(msgs);
      setLoading(false);
    });
  }, []);

  const setLocale = useCallback(async (nextLocale: Locale, persist = true) => {
    setLoading(true);
    const msgs = await loadMessages(nextLocale);
    setLocaleState(nextLocale);
    setMessages(msgs);
    localStorage.setItem('dashboard_language', nextLocale);
    if (persist) {
      // Fire and forget — save to backend user profile
      apiFetch('/api/v1/settings/language', {
        method: 'PUT',
        body: JSON.stringify({ language: nextLocale }),
      }).catch(() => {}); // non-fatal
    }
    setLoading(false);
  }, []);

  // t() — translate a dotted key with optional variable interpolation
  // e.g. t('errors.invalid_phone', { country: 'Sri Lanka' })
  const t = useCallback((key: string, vars?: Record<string, string | number>): string => {
    let result = resolveDotPath(messages as Record<string, unknown>, key);
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        result = result.replace(`{${k}}`, String(v));
      });
    }
    return result;
  }, [messages]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t, loading }}>
      {children}
    </LocaleContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useLocale() {
  return useContext(LocaleContext);
}
