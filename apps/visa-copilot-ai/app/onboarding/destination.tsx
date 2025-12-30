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

export default function OnboardingDestination() {
  const { draft, setDraft } = useOnboardingDraft();
  const [dest, setDest] = useState(draft.destination_region_hint || "");

  const canContinue = useMemo(() => dest.trim().length >= 2, [dest]);

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.kicker}>Question 2/7</Text>
        <Text style={styles.title}>Votre destination</Text>
        <Text style={styles.subtitle}>Pays ou zone (ex: “Zone Schengen”, “UK”, “Canada”…).</Text>
        <ProgressBar step={2} total={7} />
      </View>

      <GlassCard>
        <Text style={styles.label}>Destination</Text>
        <TextInput
          value={dest}
          onChangeText={setDest}
          placeholder="Ex: Zone Schengen"
          placeholderTextColor="rgba(245,247,255,0.35)"
          style={styles.input}
        />
        <View style={{ height: Tokens.space.lg }} />
        <PrimaryButton
          title="Continuer"
          onPress={() => {
            if (!canContinue) return;
            setDraft({ destination_region_hint: dest.trim() });
            router.push("/onboarding/purpose");
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

