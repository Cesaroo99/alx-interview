import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { Api, type DiagnosticResponse } from "@/src/api/client";
import { useOnboardingDraft } from "@/src/state/onboardingDraft";
import { useProfile } from "@/src/state/profile";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { ProgressBar } from "@/src/ui/ProgressBar";
import { Screen } from "@/src/ui/Screen";
import { ScorePill } from "@/src/ui/ScorePill";

export default function OnboardingSummary() {
  const { draft } = useOnboardingDraft();
  const { setProfile } = useProfile();
  const [diag, setDiag] = useState<DiagnosticResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const profilePayload = useMemo(() => {
    // profession obligatoire dans notre modèle backend
    return {
      nationality: draft.nationality || "",
      country_of_residence: draft.country_of_residence || "",
      age: draft.age ?? 0,
      profession: draft.profession || "—",
      employment_status: draft.employment_status || "other",
      travel_purpose: draft.travel_purpose || "other",
      travel_history_trips_last_5y: draft.travel_history_trips_last_5y ?? 0,
      prior_visa_refusals: draft.prior_visa_refusals ?? 0,
      destination_region_hint: draft.destination_region_hint,
      financial_profile: {
        monthly_income_usd: draft.monthly_income_usd,
        savings_usd: draft.savings_usd,
        sponsor_available: draft.sponsor_available,
      },
    };
  }, [draft]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!profilePayload.nationality) return;
      setLoading(true);
      setError(null);
      try {
        const res = await Api.diagnose(profilePayload);
        if (!cancelled) setDiag(res);
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profilePayload]);

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.kicker}>Question 7/7</Text>
        <Text style={styles.title}>Résumé</Text>
        <Text style={styles.subtitle}>On calcule une première estimation de risque et les actions prioritaires.</Text>
        <ProgressBar step={7} total={7} />
      </View>

      <GlassCard>
        <Text style={styles.cardTitle}>Votre profil</Text>
        <Text style={styles.body}>
          {profilePayload.nationality} · {profilePayload.age} ans · {profilePayload.profession}
        </Text>
        {profilePayload.destination_region_hint ? (
          <Text style={styles.body}>Destination: {profilePayload.destination_region_hint}</Text>
        ) : null}
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Diagnostic initial</Text>
        <View style={{ height: Tokens.space.md }} />
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Analyse…</Text>
          </View>
        ) : error ? (
          <Text style={styles.error}>
            {error}
            {"\n"}
            Astuce: démarrez l’API FastAPI et configurez `EXPO_PUBLIC_API_BASE_URL`.
          </Text>
        ) : diag ? (
          <>
            <ScorePill label="Readiness" value={diag.readiness_score} />
            <View style={{ height: Tokens.space.sm }} />
            <ScorePill label="Risque refus" value={diag.refusal_risk_score} kind="risk" />
            <View style={{ height: Tokens.space.md }} />
            <Text style={styles.smallTitle}>Actions prioritaires</Text>
            {diag.next_best_actions.slice(0, 3).map((a) => (
              <View key={a} style={styles.row}>
                <View style={[styles.dot, { backgroundColor: Colors.brandB }]} />
                <Text style={styles.text}>{a}</Text>
              </View>
            ))}
          </>
        ) : (
          <Text style={styles.body}>Remplissez les étapes précédentes pour lancer le diagnostic.</Text>
        )}
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Finaliser</Text>
        <Text style={styles.body}>Vous pourrez modifier ces informations plus tard.</Text>
        <View style={{ height: Tokens.space.lg }} />
        <PrimaryButton
          title="Créer mon compte local"
          onPress={async () => {
            await setProfile(profilePayload);
            router.replace("/(tabs)");
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
  cardTitle: { color: Colors.text, fontSize: Tokens.font.size.lg, fontWeight: Tokens.font.weight.bold },
  smallTitle: { color: Colors.text, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.bold },
  body: { marginTop: Tokens.space.sm, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  loadingText: { color: Colors.muted, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.medium },
  error: { color: Colors.warning, fontSize: Tokens.font.size.md, lineHeight: 22 },
  row: { flexDirection: "row", gap: 10, marginTop: Tokens.space.sm, alignItems: "flex-start" },
  dot: { width: 10, height: 10, borderRadius: 99, marginTop: 6 },
  text: { flex: 1, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
});

