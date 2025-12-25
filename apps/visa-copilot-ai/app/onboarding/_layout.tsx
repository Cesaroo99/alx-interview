import React from "react";
import { Stack } from "expo-router";

import { OnboardingDraftProvider } from "@/src/state/onboardingDraft";

export default function OnboardingLayout() {
  return (
    <OnboardingDraftProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="destination" />
        <Stack.Screen name="purpose" />
        <Stack.Screen name="status" />
        <Stack.Screen name="finance" />
        <Stack.Screen name="history" />
        <Stack.Screen name="summary" />
      </Stack>
    </OnboardingDraftProvider>
  );
}

