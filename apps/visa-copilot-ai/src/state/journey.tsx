import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type Ctx = {
  activeJourneyId: string | null;
  loaded: boolean;
  setActiveJourneyId: (id: string | null) => Promise<void>;
  clear: () => Promise<void>;
};

const STORAGE_KEY = "globalvisa.journey.v1";
const JourneyContext = createContext<Ctx | null>(null);

export function JourneyProvider({ children }: { children: React.ReactNode }) {
  const [activeJourneyId, setActiveJourneyIdState] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          if (typeof data?.activeJourneyId === "string") setActiveJourneyIdState(data.activeJourneyId);
        }
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const persist = useCallback(
    async (next: { activeJourneyId: string | null }) => {
      setActiveJourneyIdState(next.activeJourneyId);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    },
    []
  );

  const setActiveJourneyId = useCallback(
    async (id: string | null) => {
      await persist({ activeJourneyId: id });
    },
    [persist]
  );

  const clear = useCallback(async () => {
    setActiveJourneyIdState(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({ activeJourneyId, loaded, setActiveJourneyId, clear }),
    [activeJourneyId, loaded, setActiveJourneyId, clear]
  );

  return <JourneyContext.Provider value={value}>{children}</JourneyContext.Provider>;
}

export function useJourney() {
  const ctx = useContext(JourneyContext);
  if (!ctx) throw new Error("useJourney must be used within JourneyProvider");
  return ctx;
}

