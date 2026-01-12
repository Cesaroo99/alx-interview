import React, { useMemo, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";

import { useColors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { AppText } from "@/src/ui/AppText";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";
import { useProfile } from "@/src/state/profile";

function norm(s: any) {
  return String(s ?? "").trim();
}

export default function ProfileScreen() {
  const colors = useColors();
  const { profile, setProfile } = useProfile();
  const [draft, setDraft] = useState(() => ({
    nationality: norm(profile?.nationality),
    country_of_residence: norm(profile?.country_of_residence),
    age: String(profile?.age ?? ""),
    profession: norm(profile?.profession),
    destination_region_hint: norm(profile?.destination_region_hint),
  }));

  const incomplete = useMemo(() => {
    if (!draft.nationality || !draft.profession) return true;
    const a = Number(draft.age);
    if (!Number.isFinite(a) || a <= 0) return true;
    if (!draft.country_of_residence) return true;
    return false;
  }, [draft]);

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="h1">Profil</AppText>
        <AppText tone="muted">Source unique de vérité. Complétez ici, l’app ne devrait pas vous redemander 2 fois la même chose.</AppText>
      </View>

      <GlassCard>
        <AppText variant="h3">Informations principales</AppText>
        <View style={{ height: Tokens.space.md }} />

        <AppText variant="caption" tone="faint" style={styles.label}>
          Nationalité
        </AppText>
        <TextInput
          value={draft.nationality}
          onChangeText={(v) => setDraft((d) => ({ ...d, nationality: v }))}
          style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card2, color: colors.text }]}
          placeholderTextColor={colors.faint}
        />

        <View style={{ height: Tokens.space.md }} />
        <AppText variant="caption" tone="faint" style={styles.label}>
          Pays de résidence
        </AppText>
        <TextInput
          value={draft.country_of_residence}
          onChangeText={(v) => setDraft((d) => ({ ...d, country_of_residence: v }))}
          style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card2, color: colors.text }]}
          placeholderTextColor={colors.faint}
        />

        <View style={{ height: Tokens.space.md }} />
        <AppText variant="caption" tone="faint" style={styles.label}>
          Âge
        </AppText>
        <TextInput
          value={draft.age}
          onChangeText={(v) => setDraft((d) => ({ ...d, age: v }))}
          style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card2, color: colors.text }]}
          placeholder="Ex: 28"
          placeholderTextColor={colors.faint}
        />

        <View style={{ height: Tokens.space.md }} />
        <AppText variant="caption" tone="faint" style={styles.label}>
          Profession
        </AppText>
        <TextInput
          value={draft.profession}
          onChangeText={(v) => setDraft((d) => ({ ...d, profession: v }))}
          style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card2, color: colors.text }]}
          placeholderTextColor={colors.faint}
        />

        <View style={{ height: Tokens.space.md }} />
        <AppText variant="caption" tone="faint" style={styles.label}>
          Destination / zone (indice)
        </AppText>
        <TextInput
          value={draft.destination_region_hint}
          onChangeText={(v) => setDraft((d) => ({ ...d, destination_region_hint: v }))}
          style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card2, color: colors.text }]}
          placeholder="Ex: Zone Schengen"
          placeholderTextColor={colors.faint}
        />

        <View style={{ height: Tokens.space.lg }} />
        <View style={styles.row2}>
          <PrimaryButton title="Sauver & quitter" variant="ghost" onPress={() => router.push("/(tabs)")} style={{ flex: 1 }} />
          <PrimaryButton
            title="Sauver"
            onPress={async () => {
              const next = {
                ...(profile || ({} as any)),
                nationality: norm(draft.nationality),
                country_of_residence: norm(draft.country_of_residence),
                age: Number(draft.age) || 0,
                profession: norm(draft.profession),
                destination_region_hint: norm(draft.destination_region_hint) || undefined,
              };
              await setProfile(next);
              router.push("/(tabs)");
            }}
            style={{ flex: 1, opacity: incomplete ? 0.6 : 1 }}
          />
        </View>
        {incomplete ? (
          <AppText variant="caption" tone="warning" style={styles.hint}>
            Profil incomplet: ajoutez nationalité, âge, profession et pays de résidence.
          </AppText>
        ) : null}
      </GlassCard>

      <GlassCard>
        <AppText variant="h3">Onboarding</AppText>
        <AppText tone="muted" style={styles.body}>
          Si vous préférez le parcours guidé, vous pouvez relancer l’onboarding.
        </AppText>
        <View style={{ height: Tokens.space.md }} />
        <PrimaryButton title="Ouvrir l’onboarding" variant="ghost" onPress={() => router.push("/onboarding")} />
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 8 },
  title: {},
  subtitle: {},
  cardTitle: {},
  body: { marginTop: Tokens.space.sm },
  label: { marginTop: Tokens.space.sm },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: Tokens.radius.lg,
    paddingHorizontal: Tokens.space.md,
    paddingVertical: Tokens.space.md,
  },
  row2: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  hint: { marginTop: Tokens.space.sm },
});

