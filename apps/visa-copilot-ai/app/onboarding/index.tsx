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

export default function Onboarding() {
  const { draft, setDraft } = useOnboardingDraft();
  const [nationality, setNationality] = useState(draft.nationality || "");
  const [age, setAge] = useState(draft.age?.toString() || "");
  const [profession, setProfession] = useState(draft.profession || "");

  const canContinue = useMemo(() => {
    const a = Number(age);
    return nationality.trim().length >= 2 && profession.trim().length >= 2 && Number.isFinite(a) && a >= 0 && a <= 120;
  }, [age, nationality, profession]);

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.kicker}>Onboarding intelligent</Text>
        <Text style={styles.title}>Construisons votre profil</Text>
        <Text style={styles.subtitle}>
          On vous pose le minimum pour personnaliser les recommandations et détecter les risques avant toute soumission.
        </Text>
        <ProgressBar step={1} total={7} />
      </View>

      <GlassCard>
        <Text style={styles.cardTitle}>Profil de base</Text>
        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>Nationalité (passeport)</Text>
        <TextInput
          value={nationality}
          onChangeText={setNationality}
          placeholder="Ex: Maroc"
          placeholderTextColor="rgba(245,247,255,0.35)"
          style={styles.input}
        />
        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>Âge</Text>
        <TextInput
          value={age}
          onChangeText={setAge}
          placeholder="Ex: 28"
          keyboardType="number-pad"
          placeholderTextColor="rgba(245,247,255,0.35)"
          style={styles.input}
        />
        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>Profession</Text>
        <TextInput
          value={profession}
          onChangeText={setProfession}
          placeholder="Ex: Développeur logiciel"
          placeholderTextColor="rgba(245,247,255,0.35)"
          style={styles.input}
        />

        <View style={{ height: Tokens.space.lg }} />
        <PrimaryButton
          title={canContinue ? "Continuer" : "Compléter le profil"}
          onPress={async () => {
            if (!canContinue) return;
            setDraft({
              nationality: nationality.trim(),
              age: Number(age),
              profession: profession.trim(),
            });
            router.push("/onboarding/destination");
          }}
          style={{ opacity: canContinue ? 1 : 0.6 }}
        />
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Rappel</Text>
        <Text style={styles.body}>
          GlobalVisa ne remplit pas et ne soumet pas à votre place. Il vous guide et vous protège, tout en restant sur
          les plateformes officielles.
        </Text>
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 10 },
  kicker: {
    color: Colors.brandB,
    fontWeight: Tokens.font.weight.semibold,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontSize: Tokens.font.size.xs,
  },
  title: { color: Colors.text, fontSize: Tokens.font.size.hero, fontWeight: Tokens.font.weight.black, lineHeight: 38 },
  subtitle: { color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  cardTitle: { color: Colors.text, fontSize: Tokens.font.size.lg, fontWeight: Tokens.font.weight.bold },
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
  body: { marginTop: Tokens.space.sm, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
});

