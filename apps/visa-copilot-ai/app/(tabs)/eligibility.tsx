import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";

import { Api } from "@/src/api/client";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { AnimatedIn } from "@/src/ui/AnimatedIn";
import { Badge } from "@/src/ui/Badge";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";
import { SkeletonCard } from "@/src/ui/Skeleton";
import { useProfile } from "@/src/state/profile";

function toneFromColor(c: "green" | "orange" | "red") {
  if (c === "green") return "success" as const;
  if (c === "orange") return "warning" as const;
  return "danger" as const;
}

export default function EligibilityScreen() {
  const { profile, setProfile } = useProfile();
  const [country, setCountry] = useState((profile?.destination_region_hint || "canada").toLowerCase());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  // mini-form (MVP) pour enrichir l’éligibilité sans refaire tout l’onboarding
  const [edu, setEdu] = useState(String(profile?.education_level || "bachelor"));
  const [exp, setExp] = useState(String(profile?.years_experience ?? 2));
  const [lang, setLang] = useState(String(profile?.language?.band ?? 6));
  const [funds, setFunds] = useState(String(profile?.financial_capacity_usd ?? 5000));

  const canRun = useMemo(() => !!profile?.nationality && Number.isFinite(profile?.age), [profile]);

  useEffect(() => {
    setError(null);
    setData(null);
  }, [country]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Propositions de visa</Text>
        <Text style={styles.subtitle}>
          Liste de visas potentiellement accessibles + score (heuristique) et actions pour améliorer vos chances.
        </Text>
      </View>

      <AnimatedIn delayMs={0}>
        <GlassCard>
          <View style={styles.rowTop}>
            <Text style={styles.cardTitle}>Pays cible</Text>
            {loading ? <ActivityIndicator /> : null}
          </View>
          <TextInput
            value={country}
            onChangeText={setCountry}
            placeholder="Ex: canada"
            placeholderTextColor="rgba(245,247,255,0.35)"
            style={styles.input}
          />
          <View style={{ height: Tokens.space.md }} />
          <Text style={styles.label}>Niveau d’études (ex: bachelor/master/phd)</Text>
          <TextInput value={edu} onChangeText={setEdu} placeholder="bachelor" placeholderTextColor="rgba(245,247,255,0.35)" style={styles.input} />
          <View style={{ height: Tokens.space.md }} />
          <Text style={styles.label}>Expérience (années)</Text>
          <TextInput value={exp} onChangeText={setExp} keyboardType="numeric" placeholder="2" placeholderTextColor="rgba(245,247,255,0.35)" style={styles.input} />
          <View style={{ height: Tokens.space.md }} />
          <Text style={styles.label}>Langue (band 0..9, ex: 6)</Text>
          <TextInput value={lang} onChangeText={setLang} keyboardType="numeric" placeholder="6" placeholderTextColor="rgba(245,247,255,0.35)" style={styles.input} />
          <View style={{ height: Tokens.space.md }} />
          <Text style={styles.label}>Capacité financière (USD)</Text>
          <TextInput value={funds} onChangeText={setFunds} keyboardType="numeric" placeholder="5000" placeholderTextColor="rgba(245,247,255,0.35)" style={styles.input} />
          <View style={{ height: Tokens.space.lg }} />
          <PrimaryButton
            title={loading ? "Analyse…" : "Voir les propositions"}
            onPress={async () => {
              if (!profile) return;
              setLoading(true);
              setError(null);
              try {
                const enriched = {
                  ...profile,
                  destination_region_hint: country,
                  education_level: edu.trim(),
                  years_experience: Number(exp),
                  language: { exam: "self", band: Number(lang) },
                  financial_capacity_usd: Number(funds),
                };
                await setProfile(enriched);
                const res = await Api.visaProposals(country, enriched);
                setData(res);
              } catch (e: any) {
                setError(String(e?.message || e));
              } finally {
                setLoading(false);
              }
            }}
            style={{ opacity: canRun ? 1 : 0.6 }}
          />
          {!canRun ? <Text style={[styles.body, { color: Colors.warning }]}>Complétez d’abord le profil (onboarding).</Text> : null}
        </GlassCard>
      </AnimatedIn>

      {loading && !data ? (
        <AnimatedIn delayMs={100}>
          <SkeletonCard />
        </AnimatedIn>
      ) : null}

      {error ? (
        <AnimatedIn delayMs={120}>
          <GlassCard>
            <Text style={[styles.body, { color: Colors.warning }]}>{error}</Text>
            <Text style={styles.body}>Astuce: démarrez l’API FastAPI et configurez `EXPO_PUBLIC_API_BASE_URL`.</Text>
          </GlassCard>
        </AnimatedIn>
      ) : null}

      {data?.results ? (
        <AnimatedIn delayMs={160}>
          <GlassCard>
            <Text style={styles.cardTitle}>Résultats</Text>
            <Text style={styles.body}>{data.disclaimer}</Text>
            <View style={{ height: Tokens.space.md }} />
            {data.results.map((r: any) => (
              <View key={r.visaType} style={styles.resultCard}>
                <View style={styles.resultTop}>
                  <Text style={styles.resultTitle}>{r.visaType}</Text>
                  <Badge tone={toneFromColor(r.color)} label={`${r.score}%`} />
                </View>
                <Text style={styles.body}>{r.message}</Text>
                {r.missingRequirements?.length ? (
                  <>
                    <Text style={styles.smallTitle}>Manque / points bloquants</Text>
                    {r.missingRequirements.slice(0, 3).map((m: string) => (
                      <View key={m} style={styles.bulletRow}>
                        <View style={[styles.bulletDot, { backgroundColor: Colors.danger }]} />
                        <Text style={styles.bulletText}>{m}</Text>
                      </View>
                    ))}
                  </>
                ) : null}
                {r.improvementsToNextLevel?.length ? (
                  <>
                    <Text style={styles.smallTitle}>Pour passer au niveau supérieur</Text>
                    {r.improvementsToNextLevel.slice(0, 3).map((m: string) => (
                      <View key={m} style={styles.bulletRow}>
                        <View style={[styles.bulletDot, { backgroundColor: Colors.brandB }]} />
                        <Text style={styles.bulletText}>{m}</Text>
                      </View>
                    ))}
                  </>
                ) : null}
              </View>
            ))}
          </GlassCard>
        </AnimatedIn>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 8 },
  title: { color: Colors.text, fontSize: Tokens.font.size.xxl, fontWeight: Tokens.font.weight.black },
  subtitle: { color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { color: Colors.text, fontSize: Tokens.font.size.lg, fontWeight: Tokens.font.weight.bold },
  label: { color: Colors.faint, fontSize: Tokens.font.size.sm, fontWeight: Tokens.font.weight.medium, marginTop: 6 },
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
  resultCard: { marginTop: Tokens.space.lg, paddingTop: Tokens.space.md, borderTopWidth: 1, borderTopColor: Colors.border },
  resultTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  resultTitle: { color: Colors.text, fontSize: Tokens.font.size.lg, fontWeight: Tokens.font.weight.bold, flex: 1 },
  smallTitle: { marginTop: Tokens.space.md, color: Colors.text, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.bold },
  bulletRow: { flexDirection: "row", gap: 10, marginTop: Tokens.space.sm, alignItems: "flex-start" },
  bulletDot: { width: 8, height: 8, borderRadius: 99, marginTop: 6, backgroundColor: Colors.brandA },
  bulletText: { flex: 1, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
});

