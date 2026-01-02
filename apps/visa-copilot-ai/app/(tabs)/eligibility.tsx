import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";

import { Api } from "@/src/api/client";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { AnimatedIn } from "@/src/ui/AnimatedIn";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";
import { SkeletonCard } from "@/src/ui/Skeleton";
import { useProfile } from "@/src/state/profile";

function ageRangeFromAge(age?: number) {
  if (!age || age <= 0) return "";
  if (age >= 18 && age <= 25) return "18–25";
  if (age >= 26 && age <= 35) return "26–35";
  if (age >= 36 && age <= 45) return "36–45";
  return "46+";
}

export default function EligibilityScreen() {
  const { profile } = useProfile();
  const [residence, setResidence] = useState("");
  const [ageRange, setAgeRange] = useState(ageRangeFromAge(profile?.age));
  const [purpose, setPurpose] = useState((profile?.travel_purpose || "tourism").toString());
  const [destinations, setDestinations] = useState((profile?.destination_region_hint || "canada").toLowerCase());
  const [visaInterest, setVisaInterest] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  const canRun = useMemo(() => !!profile?.nationality && Number.isFinite(profile?.age) && !!ageRange && !!purpose, [profile, ageRange, purpose]);

  useEffect(() => {
    setError(null);
    setData(null);
  }, [destinations]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Visa Eligibility Engine</Text>
        <Text style={styles.subtitle}>
          Évalue vos meilleures options de visa par probabilité (High/Medium/Low), explique les risques, et propose des voies stratégiques.
        </Text>
      </View>

      <AnimatedIn delayMs={0}>
        <GlassCard>
          <View style={styles.rowTop}>
            <Text style={styles.cardTitle}>Entrée (REQUIS + OPTIONNELS)</Text>
            {loading ? <ActivityIndicator /> : null}
          </View>
          <Text style={styles.label}>Nationalité (REQUIS)</Text>
          <TextInput value={profile?.nationality || ""} editable={false} style={[styles.input, { opacity: 0.8 }]} />
          <View style={{ height: Tokens.space.md }} />
          <Text style={styles.label}>Pays de résidence (REQUIS)</Text>
          <TextInput value={residence} onChangeText={setResidence} placeholder="Ex: Maroc" placeholderTextColor="rgba(16,22,47,0.35)" style={styles.input} />
          <View style={{ height: Tokens.space.md }} />
          <Text style={styles.label}>Tranche d’âge (REQUIS)</Text>
          <TextInput value={ageRange} onChangeText={setAgeRange} placeholder="18–25 / 26–35 / 36–45 / 46+" placeholderTextColor="rgba(16,22,47,0.35)" style={styles.input} />
          <View style={{ height: Tokens.space.md }} />
          <Text style={styles.label}>But principal (REQUIS)</Text>
          <TextInput
            value={purpose}
            onChangeText={setPurpose}
            placeholder="Study / Work / Tourism / Business / Transit / Family reunion / Permanent residence"
            placeholderTextColor="rgba(16,22,47,0.35)"
            style={styles.input}
          />
          <View style={{ height: Tokens.space.md }} />
          <Text style={styles.label}>Destinations (REQUIS, ou “pas de préférence”)</Text>
          <TextInput
            value={destinations}
            onChangeText={setDestinations}
            placeholder="Ex: canada, france (ou: pas de préférence)"
            placeholderTextColor="rgba(16,22,47,0.35)"
            style={styles.input}
          />
          <View style={{ height: Tokens.space.md }} />
          <Text style={styles.label}>Visa(s) d’intérêt (OPTIONNEL)</Text>
          <TextInput
            value={visaInterest}
            onChangeText={setVisaInterest}
            placeholder="Ex: étudiant, touristique (séparés par virgules)"
            placeholderTextColor="rgba(16,22,47,0.35)"
            style={styles.input}
          />
          <View style={{ height: Tokens.space.lg }} />
          <PrimaryButton
            title={loading ? "Analyse…" : "Lancer l’évaluation"}
            onPress={async () => {
              if (!profile) return;
              setLoading(true);
              setError(null);
              try {
                const dests = destinations
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean);
                const interest = visaInterest
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean);
                const res = await Api.visaEligibilityEngine({
                  identity: {
                    nationality: profile.nationality,
                    country_of_residence: residence,
                    age_range: ageRange,
                  },
                  objective: {
                    purpose,
                    destinations: dests.length ? dests : ["no_preference"],
                    visa_types_interest: interest,
                  },
                });
                setData(res);
              } catch (e: any) {
                setError(String(e?.message || e));
              } finally {
                setLoading(false);
              }
            }}
            style={{ opacity: canRun ? 1 : 0.6 }}
          />
          {!profile?.nationality || !Number.isFinite(profile?.age) ? (
            <Text style={[styles.body, { color: Colors.warning }]}>Complétez d’abord le profil (onboarding).</Text>
          ) : null}
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

      {data?.ok ? (
        <AnimatedIn delayMs={160}>
          <GlassCard>
            <Text style={styles.cardTitle}>Résultats</Text>
            {data.disclaimer ? <Text style={styles.body}>{data.disclaimer}</Text> : null}
            {Array.isArray(data.assumptions) && data.assumptions.length ? (
              <Text style={styles.hint}>Hypothèses: {data.assumptions.join(" · ")}</Text>
            ) : null}
            <View style={{ height: Tokens.space.md }} />
            <Text style={styles.smallTitle}>A. Top visa options</Text>
            {(data.top_visa_options || []).map((o: any) => (
              <View key={`${o.country}_${o.visa_type}`} style={styles.resultCard}>
                <Text style={styles.resultTitle}>
                  {o.country.toUpperCase()} · {o.visa_type} · {o.estimated_approval_likelihood}
                </Text>
                {o.key_reasons_supporting_eligibility?.length ? (
                  <>
                    <Text style={styles.smallTitle}>Raisons</Text>
                    {o.key_reasons_supporting_eligibility.slice(0, 4).map((m: string) => (
                      <View key={m} style={styles.bulletRow}>
                        <View style={[styles.bulletDot, { backgroundColor: Colors.success }]} />
                        <Text style={styles.bulletText}>{m}</Text>
                      </View>
                    ))}
                  </>
                ) : null}
                {o.main_risk_factors?.length ? (
                  <>
                    <Text style={styles.smallTitle}>Risques</Text>
                    {o.main_risk_factors.slice(0, 4).map((m: string) => (
                      <View key={m} style={styles.bulletRow}>
                        <View style={[styles.bulletDot, { backgroundColor: Colors.warning }]} />
                        <Text style={styles.bulletText}>{m}</Text>
                      </View>
                    ))}
                  </>
                ) : null}
                <Text style={styles.hint}>
                  Délai: {o.typical_processing_time_range} · Budget min:{" "}
                  {o.estimated_minimum_budget_usd === null || o.estimated_minimum_budget_usd === undefined ? "—" : `${o.estimated_minimum_budget_usd} USD`}
                </Text>
              </View>
            ))}

            {Array.isArray(data.alternative_strategic_pathways) && data.alternative_strategic_pathways.length ? (
              <>
                <Text style={styles.smallTitle}>B. Pathways</Text>
                {data.alternative_strategic_pathways.map((p: string) => (
                  <View key={p} style={styles.bulletRow}>
                    <View style={[styles.bulletDot, { backgroundColor: Colors.brandA }]} />
                    <Text style={styles.bulletText}>{p}</Text>
                  </View>
                ))}
              </>
            ) : null}

            {data.profile_strength_score?.total !== undefined ? (
              <>
                <Text style={styles.smallTitle}>C. Score profil</Text>
                <Text style={styles.body}>Total: {data.profile_strength_score.total}/100</Text>
              </>
            ) : null}

            {Array.isArray(data.improvement_recommendations) && data.improvement_recommendations.length ? (
              <>
                <Text style={styles.smallTitle}>D. Recommandations</Text>
                {data.improvement_recommendations.slice(0, 6).map((p: string) => (
                  <View key={p} style={styles.bulletRow}>
                    <View style={[styles.bulletDot, { backgroundColor: Colors.brandB }]} />
                    <Text style={styles.bulletText}>{p}</Text>
                  </View>
                ))}
              </>
            ) : null}

            {data.next_question ? <Text style={[styles.body, { marginTop: Tokens.space.md }]}>{data.next_question}</Text> : null}
          </GlassCard>
        </AnimatedIn>
      ) : data?.ok === false ? (
        <AnimatedIn delayMs={160}>
          <GlassCard>
            <Text style={[styles.body, { color: Colors.warning }]}>{data.error || "Erreur"}</Text>
            {Array.isArray(data.missing_required) && data.missing_required.length ? (
              <Text style={styles.body}>Champs requis manquants: {data.missing_required.join(", ")}</Text>
            ) : null}
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
  hint: { marginTop: Tokens.space.sm, color: Colors.faint, fontSize: Tokens.font.size.sm, lineHeight: 20 },
  resultCard: { marginTop: Tokens.space.lg, paddingTop: Tokens.space.md, borderTopWidth: 1, borderTopColor: Colors.border },
  resultTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  resultTitle: { color: Colors.text, fontSize: Tokens.font.size.lg, fontWeight: Tokens.font.weight.bold, flex: 1 },
  smallTitle: { marginTop: Tokens.space.md, color: Colors.text, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.bold },
  bulletRow: { flexDirection: "row", gap: 10, marginTop: Tokens.space.sm, alignItems: "flex-start" },
  bulletDot: { width: 8, height: 8, borderRadius: 99, marginTop: 6, backgroundColor: Colors.brandA },
  bulletText: { flex: 1, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: Tokens.space.sm },
});

