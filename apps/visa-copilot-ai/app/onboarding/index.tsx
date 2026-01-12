import React, { useMemo, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";

import { useOnboardingDraft } from "@/src/state/onboardingDraft";
import { useColors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { AppText } from "@/src/ui/AppText";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { ProgressBar } from "@/src/ui/ProgressBar";
import { Screen } from "@/src/ui/Screen";

export default function Onboarding() {
  const colors = useColors();
  const { draft, setDraft } = useOnboardingDraft();
  const [nationality, setNationality] = useState(draft.nationality || "");
  const [residence, setResidence] = useState(draft.country_of_residence || "");
  const [age, setAge] = useState(draft.age?.toString() || "");
  const [profession, setProfession] = useState(draft.profession || "");

  const canContinue = useMemo(() => {
    const a = Number(age);
    return nationality.trim().length >= 2 && residence.trim().length >= 2 && profession.trim().length >= 2 && Number.isFinite(a) && a >= 0 && a <= 120;
  }, [age, nationality, profession, residence]);

  return (
    <Screen>
      <View style={styles.hero}>
        <AppText variant="caption" tone="brand" style={styles.kicker}>
          Onboarding intelligent
        </AppText>
        <AppText variant="h1">Construisons votre profil</AppText>
        <AppText tone="muted">
          On vous pose le minimum pour personnaliser les recommandations et détecter les risques avant toute soumission.
        </AppText>
        <ProgressBar step={1} total={7} />
      </View>

      <GlassCard>
        <AppText variant="h3">Profil de base</AppText>
        <View style={{ height: Tokens.space.md }} />
        <AppText variant="caption" tone="faint" style={styles.label}>
          Nationalité (passeport)
        </AppText>
        <TextInput
          value={nationality}
          onChangeText={setNationality}
          placeholder="Ex: Maroc"
          placeholderTextColor={colors.faint}
          style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card2, color: colors.text }]}
        />
        <View style={{ height: Tokens.space.md }} />
        <AppText variant="caption" tone="faint" style={styles.label}>
          Pays de résidence
        </AppText>
        <TextInput
          value={residence}
          onChangeText={setResidence}
          placeholder="Ex: Maroc"
          placeholderTextColor={colors.faint}
          style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card2, color: colors.text }]}
        />
        <View style={{ height: Tokens.space.md }} />
        <AppText variant="caption" tone="faint" style={styles.label}>
          Âge
        </AppText>
        <TextInput
          value={age}
          onChangeText={setAge}
          placeholder="Ex: 28"
          keyboardType="number-pad"
          placeholderTextColor={colors.faint}
          style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card2, color: colors.text }]}
        />
        <View style={{ height: Tokens.space.md }} />
        <AppText variant="caption" tone="faint" style={styles.label}>
          Profession
        </AppText>
        <TextInput
          value={profession}
          onChangeText={setProfession}
          placeholder="Ex: Développeur logiciel"
          placeholderTextColor={colors.faint}
          style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card2, color: colors.text }]}
        />

        <View style={{ height: Tokens.space.lg }} />
        <PrimaryButton
          title={canContinue ? "Continuer" : "Compléter le profil"}
          onPress={async () => {
            if (!canContinue) return;
            setDraft({
              nationality: nationality.trim(),
              country_of_residence: residence.trim(),
              age: Number(age),
              profession: profession.trim(),
            });
            router.push("/onboarding/destination");
          }}
          style={{ opacity: canContinue ? 1 : 0.6 }}
        />
      </GlassCard>

      <GlassCard>
        <AppText variant="h3">Rappel</AppText>
        <AppText tone="muted" style={styles.body}>
          GlobalVisa ne remplit pas et ne soumet pas à votre place. Il vous guide et vous protège, tout en restant sur
          les plateformes officielles.
        </AppText>
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 10 },
  kicker: {
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {},
  subtitle: {},
  cardTitle: {},
  label: {},
  input: {
    marginTop: 8,
    borderRadius: Tokens.radius.lg,
    borderWidth: 1,
    paddingHorizontal: Tokens.space.md,
    paddingVertical: Tokens.space.md,
  },
  body: { marginTop: Tokens.space.sm },
});

