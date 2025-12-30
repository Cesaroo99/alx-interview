import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Locale = "fr" | "en";

type Ctx = {
  locale: Locale;
  loaded: boolean;
  setLocale: (l: Locale) => Promise<void>;
  // helper simple: pas de clés pour l’instant, mais centralisé (i18n globale)
  tr: (fr: string, en: string) => string;
};

const STORAGE_KEY = "globalvisa.locale.v1";
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("fr");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw === "en" || raw === "fr") setLocaleState(raw);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const setLocale = useCallback(async (l: Locale) => {
    setLocaleState(l);
    await AsyncStorage.setItem(STORAGE_KEY, l);
  }, []);

  const tr = useCallback(
    (fr: string, en: string) => {
      return locale === "fr" ? fr : en;
    },
    [locale]
  );

  const value = useMemo(() => ({ locale, loaded, setLocale, tr }), [locale, loaded, setLocale, tr]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

