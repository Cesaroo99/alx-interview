import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";
import { useProfile } from "@/src/state/profile";

function norm(s: any) {
  return String(s ?? "").trim();
}

export default function ProfileScreen() {
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
        <Text style={styles.title}>Profil</Text>
        <Text style={styles.subtitle}>Source unique de vérité. Complétez ici, l’app ne devrait pas vous redemander 2 fois la même chose.</Text>
      </View>

      <GlassCard>
        <Text style={styles.cardTitle}>Informations principales</Text>
        <View style={{ height: Tokens.space.md }} />

        <Text style={styles.label}>Nationalité</Text>
        <TextInput value={draft.nationality} onChangeText={(v) => setDraft((d) => ({ ...d, nationality: v }))} style={styles.input} placeholderTextColor="rgba(16,22,47,0.35)" />

        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>Pays de résidence</Text>
        <TextInput
          value={draft.country_of_residence}
          onChangeText={(v) => setDraft((d) => ({ ...d, country_of_residence: v }))}
          style={styles.input}
          placeholderTextColor="rgba(16,22,47,0.35)"
        />

        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>Âge</Text>
        <TextInput value={draft.age} onChangeText={(v) => setDraft((d) => ({ ...d, age: v }))} style={styles.input} placeholder="Ex: 28" placeholderTextColor="rgba(16,22,47,0.35)" />

        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>Profession</Text>
        <TextInput value={draft.profession} onChangeText={(v) => setDraft((d) => ({ ...d, profession: v }))} style={styles.input} placeholderTextColor="rgba(16,22,47,0.35)" />

        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>Destination / zone (indice)</Text>
        <TextInput
          value={draft.destination_region_hint}
          onChangeText={(v) => setDraft((d) => ({ ...d, destination_region_hint: v }))}
          style={styles.input}
          placeholder="Ex: Zone Schengen"
          placeholderTextColor="rgba(16,22,47,0.35)"
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
        {incomplete ? <Text style={styles.hint}>Profil incomplet: ajoutez nationalité, âge, profession et pays de résidence.</Text> : null}
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Onboarding</Text>
        <Text style={styles.body}>Si vous préférez le parcours guidé, vous pouvez relancer l’onboarding.</Text>
        <View style={{ height: Tokens.space.md }} />
        <PrimaryButton title="Ouvrir l’onboarding" variant="ghost" onPress={() => router.push("/onboarding")} />
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 8 },
  title: { color: Colors.text, fontSize: Tokens.font.size.xxl, fontWeight: Tokens.font.weight.black },
  subtitle: { color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  cardTitle: { color: Colors.text, fontSize: Tokens.font.size.lg, fontWeight: Tokens.font.weight.bold },
  body: { marginTop: Tokens.space.sm, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  label: { marginTop: Tokens.space.sm, color: Colors.faint, fontSize: Tokens.font.size.sm, fontWeight: Tokens.font.weight.semibold },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card2,
    color: Colors.text,
    borderRadius: Tokens.radius.lg,
    paddingHorizontal: Tokens.space.md,
    paddingVertical: Tokens.space.md,
    fontSize: Tokens.font.size.md,
  },
  row2: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  hint: { marginTop: Tokens.space.sm, color: Colors.warning, fontSize: Tokens.font.size.sm, lineHeight: 20 },
});

