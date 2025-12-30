import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { useOnboardingDraft } from "@/src/state/onboardingDraft";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { ProgressBar } from "@/src/ui/ProgressBar";
import { Screen } from "@/src/ui/Screen";

const OPTIONS = [
  { key: "employed", label: "Salarié" },
  { key: "self_employed", label: "Indépendant" },
  { key: "student", label: "Étudiant" },
  { key: "unemployed", label: "Sans emploi" },
  { key: "retired", label: "Retraité" },
  { key: "other", label: "Autre" },
] as const;

export default function OnboardingStatus() {
  const { draft, setDraft } = useOnboardingDraft();
  const [status, setStatus] = useState<(typeof OPTIONS)[number]["key"]>((draft.employment_status as any) || "employed");
  const canContinue = useMemo(() => !!status, [status]);

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.kicker}>Question 4/7</Text>
        <Text style={styles.title}>Statut professionnel</Text>
        <Text style={styles.subtitle}>Cela sert à vérifier la cohérence (attaches, justificatifs, finances).</Text>
        <ProgressBar step={4} total={7} />
      </View>

      <GlassCard>
        <Text style={styles.label}>Choisir un statut</Text>
        <View style={{ height: Tokens.space.md }} />
        <View style={styles.grid}>
          {OPTIONS.map((o) => (
            <PrimaryButton
              key={o.key}
              title={o.label}
              variant={status === o.key ? "brand" : "ghost"}
              onPress={() => setStatus(o.key)}
              style={styles.choice}
            />
          ))}
        </View>
        <View style={{ height: Tokens.space.lg }} />
        <PrimaryButton
          title="Continuer"
          onPress={() => {
            if (!canContinue) return;
            setDraft({ employment_status: status });
            router.push("/onboarding/finance");
          }}
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
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6 },
  choice: { flexGrow: 1, minWidth: "48%" },
});

