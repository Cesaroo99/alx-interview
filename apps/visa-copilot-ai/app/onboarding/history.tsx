import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { useOnboardingDraft } from "@/src/state/onboardingDraft";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { ProgressBar } from "@/src/ui/ProgressBar";
import { Screen } from "@/src/ui/Screen";

export default function OnboardingHistory() {
  const { draft, setDraft } = useOnboardingDraft();
  const [trips, setTrips] = useState((draft.travel_history_trips_last_5y ?? 0).toString());
  const [refusals, setRefusals] = useState((draft.prior_visa_refusals ?? 0).toString());

  const canContinue = useMemo(() => {
    const t = Number(trips);
    const r = Number(refusals);
    return Number.isFinite(t) && t >= 0 && t <= 99 && Number.isFinite(r) && r >= 0 && r <= 99;
  }, [trips, refusals]);

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.kicker}>Question 6/7</Text>
        <Text style={styles.title}>Historique</Text>
        <Text style={styles.subtitle}>Ces infos aident à estimer le risque et les points à renforcer.</Text>
        <ProgressBar step={6} total={7} />
      </View>

      <GlassCard>
        <Text style={styles.label}>Voyages (5 dernières années)</Text>
        <TextInput
          value={trips}
          onChangeText={setTrips}
          keyboardType="number-pad"
          placeholder="Ex: 2"
          placeholderTextColor="rgba(245,247,255,0.35)"
          style={styles.input}
        />
        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>Refus de visa précédents</Text>
        <TextInput
          value={refusals}
          onChangeText={setRefusals}
          keyboardType="number-pad"
          placeholder="Ex: 0"
          placeholderTextColor="rgba(245,247,255,0.35)"
          style={styles.input}
        />

        <View style={{ height: Tokens.space.lg }} />
        <PrimaryButton
          title="Continuer"
          onPress={() => {
            if (!canContinue) return;
            setDraft({
              travel_history_trips_last_5y: Number(trips),
              prior_visa_refusals: Number(refusals),
            });
            router.push("/onboarding/summary");
          }}
          style={{ opacity: canContinue ? 1 : 0.6 }}
        />
        <View style={{ height: Tokens.space.sm }} />
        <PrimaryButton title="Retour" variant="ghost" onPress={() => router.back()} />
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 10 },
  kicker: { color: Colors.brandB, fontWeight: Tokens.font.weight.semibold, letterSpacing: 1, fontSize: Tokens.font.size.xs },
  title: { color: Colors.text, fontSize: Tokens.font.size.hero, fontWeight: Tokens.font.weight.black, lineHeight: 38 },
  subtitle: { color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  label: { color: Colors.faint, fontSize: Tokens.font.size.sm, fontWeight: Tokens.font.weight.medium },
  input: {
    marginTop: 8,
    borderRadius: Tokens.radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card2,
    paddingHorizontal: Tokens.space.md,
    paddingVertical: Tokens.space.md,
    color: Colors.text,
    fontSize: Tokens.font.size.md,
  },
});

