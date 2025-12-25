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

export default function OnboardingFinance() {
  const { draft, setDraft } = useOnboardingDraft();
  const [income, setIncome] = useState(draft.monthly_income_usd?.toString() || "");
  const [savings, setSavings] = useState(draft.savings_usd?.toString() || "");
  const [sponsor, setSponsor] = useState<boolean>(!!draft.sponsor_available);

  const canContinue = useMemo(() => true, []);

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.kicker}>Question 5/7</Text>
        <Text style={styles.title}>Finances (optionnel)</Text>
        <Text style={styles.subtitle}>On s’en sert pour détecter les risques de refus (capacité financière).</Text>
        <ProgressBar step={5} total={7} />
      </View>

      <GlassCard>
        <Text style={styles.label}>Revenu mensuel (USD)</Text>
        <TextInput
          value={income}
          onChangeText={setIncome}
          keyboardType="numeric"
          placeholder="Ex: 1800"
          placeholderTextColor="rgba(245,247,255,0.35)"
          style={styles.input}
        />
        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>Épargne (USD)</Text>
        <TextInput
          value={savings}
          onChangeText={setSavings}
          keyboardType="numeric"
          placeholder="Ex: 4200"
          placeholderTextColor="rgba(245,247,255,0.35)"
          style={styles.input}
        />

        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>Sponsor disponible ?</Text>
        <View style={styles.row}>
          <PrimaryButton title="Oui" variant={sponsor ? "brand" : "ghost"} onPress={() => setSponsor(true)} style={styles.half} />
          <PrimaryButton title="Non" variant={!sponsor ? "brand" : "ghost"} onPress={() => setSponsor(false)} style={styles.half} />
        </View>

        <View style={{ height: Tokens.space.lg }} />
        <PrimaryButton
          title="Continuer"
          onPress={() => {
            if (!canContinue) return;
            setDraft({
              monthly_income_usd: income.trim() ? Number(income) : undefined,
              savings_usd: savings.trim() ? Number(savings) : undefined,
              sponsor_available: sponsor,
            });
            router.push("/onboarding/history");
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
  row: { flexDirection: "row", gap: 10, marginTop: 8 },
  half: { flex: 1 },
});

