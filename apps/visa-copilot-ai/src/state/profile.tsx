import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type UserProfile = {
  nationality: string;
  age: number;
  profession: string;
  employment_status?: "employed" | "self_employed" | "student" | "unemployed" | "retired" | "other";
  travel_purpose?: "tourism" | "business" | "study" | "family" | "transit" | "medical" | "other";
  travel_history_trips_last_5y?: number;
  prior_visa_refusals?: number;
  destination_region_hint?: string;
  notes?: string;
  financial_profile?: {
    monthly_income_usd?: number;
    savings_usd?: number;
    sponsor_available?: boolean;
  };
};

const STORAGE_KEY = "visa_copilot_ai.profile.v1";

type Ctx = {
  profile: UserProfile | null;
  loaded: boolean;
  setProfile: (p: UserProfile) => Promise<void>;
  clearProfile: () => Promise<void>;
};

const ProfileContext = createContext<Ctx | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setProfileState(JSON.parse(raw));
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const setProfile = useCallback(async (p: UserProfile) => {
    setProfileState(p);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  }, []);

  const clearProfile = useCallback(async () => {
    setProfileState(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(() => ({ profile, loaded, setProfile, clearProfile }), [profile, loaded, setProfile, clearProfile]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}

