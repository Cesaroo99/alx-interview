import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { DiagnosticResponse } from "@/src/api/client";

export type DossierSummary = {
  readiness_score: number;
  coherence_score: number;
  readiness_level: string;
  key_risks: string[];
  next_best_actions: string[];
  updatedAt: number;
  destination_region?: string;
  visa_type?: string;
};

export type InsightsState = {
  lastDiagnostic?: (DiagnosticResponse & { updatedAt: number });
  lastDossier?: DossierSummary;
};

const STORAGE_KEY = "globalvisa.insights.v1";

type Ctx = {
  insights: InsightsState;
  loaded: boolean;
  setLastDiagnostic: (d: DiagnosticResponse) => Promise<void>;
  setLastDossier: (d: Omit<DossierSummary, "updatedAt">) => Promise<void>;
  clear: () => Promise<void>;
};

const InsightsContext = createContext<Ctx | null>(null);

export function InsightsProvider({ children }: { children: React.ReactNode }) {
  const [insights, setInsights] = useState<InsightsState>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setInsights(JSON.parse(raw));
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const persist = useCallback(async (next: InsightsState) => {
    setInsights(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const setLastDiagnostic = useCallback(
    async (d: DiagnosticResponse) => {
      const next: InsightsState = {
        ...insights,
        lastDiagnostic: { ...d, updatedAt: Date.now() },
      };
      await persist(next);
    },
    [insights, persist]
  );

  const setLastDossier = useCallback(
    async (d: Omit<DossierSummary, "updatedAt">) => {
      const next: InsightsState = {
        ...insights,
        lastDossier: { ...d, updatedAt: Date.now() },
      };
      await persist(next);
    },
    [insights, persist]
  );

  const clear = useCallback(async () => {
    await persist({});
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, [persist]);

  const value = useMemo(
    () => ({ insights, loaded, setLastDiagnostic, setLastDossier, clear }),
    [insights, loaded, setLastDiagnostic, setLastDossier, clear]
  );

  return <InsightsContext.Provider value={value}>{children}</InsightsContext.Provider>;
}

export function useInsights() {
  const ctx = useContext(InsightsContext);
  if (!ctx) throw new Error("useInsights must be used within InsightsProvider");
  return ctx;
}

