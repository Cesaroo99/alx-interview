import React, { createContext, useContext, useMemo, useState } from "react";

export type OnboardingDraft = {
  nationality?: string;
  country_of_residence?: string;
  destination_region_hint?: string;
  travel_purpose?: "tourism" | "business" | "study" | "family" | "transit" | "medical" | "other";
  employment_status?: "employed" | "self_employed" | "student" | "unemployed" | "retired" | "other";
  age?: number;
  travel_history_trips_last_5y?: number;
  prior_visa_refusals?: number;
  monthly_income_usd?: number;
  savings_usd?: number;
  sponsor_available?: boolean;
  profession?: string;
};

type Ctx = {
  draft: OnboardingDraft;
  setDraft: (patch: Partial<OnboardingDraft>) => void;
  reset: () => void;
};

const OnboardingContext = createContext<Ctx | null>(null);

export function OnboardingDraftProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraftState] = useState<OnboardingDraft>({});
  const value = useMemo(
    () => ({
      draft,
      setDraft: (patch: Partial<OnboardingDraft>) => setDraftState((d) => ({ ...d, ...patch })),
      reset: () => setDraftState({}),
    }),
    [draft]
  );
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboardingDraft() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboardingDraft must be used within OnboardingDraftProvider");
  return ctx;
}

