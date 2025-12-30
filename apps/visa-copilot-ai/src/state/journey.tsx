import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type Ctx = {
  activeJourneyId: string | null;
  locale: "fr" | "en";
  loaded: boolean;
  setActiveJourneyId: (id: string | null) => Promise<void>;
  setLocale: (l: "fr" | "en") => Promise<void>;
  clear: () => Promise<void>;
};

const STORAGE_KEY = "globalvisa.journey.v1";
const JourneyContext = createContext<Ctx | null>(null);

export function JourneyProvider({ children }: { children: React.ReactNode }) {
  const [activeJourneyId, setActiveJourneyIdState] = useState<string | null>(null);
  const [locale, setLocaleState] = useState<"fr" | "en">("fr");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          if (typeof data?.activeJourneyId === "string") setActiveJourneyIdState(data.activeJourneyId);
          if (data?.locale === "en" || data?.locale === "fr") setLocaleState(data.locale);
        }
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const persist = useCallback(
    async (next: { activeJourneyId: string | null; locale: "fr" | "en" }) => {
      setActiveJourneyIdState(next.activeJourneyId);
      setLocaleState(next.locale);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    },
    []
  );

  const setActiveJourneyId = useCallback(
    async (id: string | null) => {
      await persist({ activeJourneyId: id, locale });
    },
    [persist, locale]
  );

  const setLocale = useCallback(
    async (l: "fr" | "en") => {
      await persist({ activeJourneyId, locale: l });
    },
    [persist, activeJourneyId]
  );

  const clear = useCallback(async () => {
    setActiveJourneyIdState(null);
    setLocaleState("fr");
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({ activeJourneyId, locale, loaded, setActiveJourneyId, setLocale, clear }),
    [activeJourneyId, locale, loaded, setActiveJourneyId, setLocale, clear]
  );

  return <JourneyContext.Provider value={value}>{children}</JourneyContext.Provider>;
}

export function useJourney() {
  const ctx = useContext(JourneyContext);
  if (!ctx) throw new Error("useJourney must be used within JourneyProvider");
  return ctx;
}

