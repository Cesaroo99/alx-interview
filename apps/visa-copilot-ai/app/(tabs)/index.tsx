import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { Api } from "@/src/api/client";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { AnimatedIn } from "@/src/ui/AnimatedIn";
import { Badge } from "@/src/ui/Badge";
import { GlassCard } from "@/src/ui/GlassCard";
import { HeroBanner } from "@/src/ui/HeroBanner";
import { ActionButton } from "@/src/ui/ActionButton";
import { ProgressBar } from "@/src/ui/ProgressBar";
import { Screen } from "@/src/ui/Screen";
import { SkeletonCard } from "@/src/ui/Skeleton";
import { ScorePill } from "@/src/ui/ScorePill";
import { useDocuments } from "@/src/state/documents";
import { useInsights } from "@/src/state/insights";
import { useJourney } from "@/src/state/journey";
import { useProfile } from "@/src/state/profile";

export default function HomeScreen() {
  const { profile, clearProfile } = useProfile();
  const { docs } = useDocuments();
  const { insights, setLastDiagnostic } = useInsights();
  const { activeJourneyId, clear: clearJourney } = useJourney();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!profile) return;
      setLoading(true);
      setError(null);
      try {
        const res = await Api.diagnose(profile);
        if (!cancelled) await setLastDiagnostic(res);
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const completion = useMemo(() => {
    const total = 6;
    let done = 0;
    if (profile?.nationality && profile?.profession && Number.isFinite(profile.age)) done += 1;
    if (profile?.destination_region_hint) done += 1;
    if (docs.some((d) => d.doc_type === "passport")) done += 1;
    if (docs.some((d) => d.doc_type === "bank_statement")) done += 1;
    if (docs.length >= 3) done += 1;
    if (insights.lastDossier) done += 1;
    return { done, total };
  }, [profile, docs, insights.lastDossier]);

  const criticalAlerts = useMemo(() => {
    const alerts: string[] = [];
    if (!profile) alerts.push("Profil incomplet: lancez l’onboarding.");
    if (!docs.some((d) => d.doc_type === "passport")) alerts.push("Passeport manquant dans Documents.");
    if (insights.lastDossier?.readiness_level === "not_ready") alerts.push("Dossier: pas prêt. Corrigez avant dépôt.");
    return alerts.slice(0, 3);
  }, [profile, docs, insights.lastDossier]);

  return (
    <Screen>
      <HeroBanner
        kicker="GlobalVisa"
        title="Tableau de bord"
        subtitle="Statut global, alertes, progression et prochaines actions visa‑first."
      />

      <AnimatedIn delayMs={0}>
        <GlassCard>
          <View style={styles.rowTop}>
            <Text style={styles.cardTitle}>Progression</Text>
            <Badge
              label={`${completion.done}/${completion.total}`}
              tone={completion.done === completion.total ? "success" : completion.done >= 3 ? "warning" : "danger"}
            />
          </View>
          <View style={{ height: Tokens.space.sm }} />
          <ProgressBar step={completion.done} total={completion.total} />
          <Text style={styles.body}>
            {profile ? `${profile.nationality} · ${profile.age} ans · ${profile.profession}` : "Aucun profil"}
          </Text>
          <View style={{ height: Tokens.space.md }} />
          <View style={styles.ctaRow}>
            <ActionButton
              title="Parcours"
              variant="ghost"
              onPress={() => router.push("/(tabs)/parcours")}
              style={{ flex: 1 }}
              track={{ type: "nav", label: "open_parcours", screen: "home" }}
            />
            <ActionButton
              title="Docs"
              variant="ghost"
              onPress={() => router.push("/(tabs)/documents")}
              style={{ flex: 1 }}
              track={{ type: "nav", label: "open_documents", screen: "home" }}
            />
          </View>
        </GlassCard>
      </AnimatedIn>

      {activeJourneyId ? (
        <GlassCard>
          <Text style={styles.cardTitle}>Parcours actif</Text>
          <Text style={styles.body}>ID: {activeJourneyId}</Text>
          <View style={{ height: Tokens.space.md }} />
          <View style={styles.ctaRow}>
            <ActionButton
              title="Ouvrir"
              variant="ghost"
              onPress={() => router.push(`/journeys/${activeJourneyId}`)}
              style={{ flex: 1 }}
              track={{ type: "nav", label: "open_active_journey", screen: "home" }}
            />
            <ActionButton
              title="Désactiver"
              variant="ghost"
              onPress={() => clearJourney()}
              style={{ flex: 1 }}
              track={{ type: "journey", label: "clear_active_journey", screen: "home" }}
            />
          </View>
        </GlassCard>
      ) : null}

      <AnimatedIn delayMs={90}>
        <GlassCard>
          <Text style={styles.cardTitle}>Alertes critiques</Text>
          <View style={{ height: Tokens.space.sm }} />
          {criticalAlerts.length ? (
            criticalAlerts.map((a) => (
              <View key={a} style={styles.bulletRow}>
                <View style={[styles.bulletDot, { backgroundColor: Colors.danger }]} />
                <Text style={styles.bulletText}>{a}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.body}>Aucune alerte critique détectée.</Text>
          )}
        </GlassCard>
      </AnimatedIn>

      <AnimatedIn delayMs={160}>
        <GlassCard>
          <View style={styles.rowTop}>
            <Text style={styles.cardTitle}>Dernier diagnostic</Text>
            {loading ? <ActivityIndicator /> : null}
          </View>
          <View style={{ height: Tokens.space.md }} />
          {error ? (
            <Text style={styles.warn}>API indisponible (affichage des derniers résultats si disponibles).</Text>
          ) : null}
          {loading && !insights.lastDiagnostic ? (
            <SkeletonCard />
          ) : insights.lastDiagnostic ? (
            <>
              <ScorePill label="Readiness" value={insights.lastDiagnostic.readiness_score} />
              <View style={{ height: Tokens.space.sm }} />
              <ScorePill label="Risque refus" value={insights.lastDiagnostic.refusal_risk_score} kind="risk" />
              <View style={{ height: Tokens.space.lg }} />
              <ActionButton
                title="Ouvrir le diagnostic"
                onPress={() => router.push("/(tabs)/diagnostic")}
                track={{ type: "nav", label: "open_diagnostic", screen: "home" }}
              />
            </>
          ) : (
            <Text style={styles.body}>Lancez un diagnostic pour voir vos scores.</Text>
          )}
        </GlassCard>
      </AnimatedIn>

      <AnimatedIn delayMs={220}>
        <GlassCard>
          <Text style={styles.cardTitle}>Dernier score dossier</Text>
          <View style={{ height: Tokens.space.md }} />
          {insights.lastDossier ? (
            <>
              <ScorePill label="Readiness dossier" value={insights.lastDossier.readiness_score} />
              <View style={{ height: Tokens.space.sm }} />
              <Text style={styles.body}>
                Cohérence: {Math.round(insights.lastDossier.coherence_score)}/100 · Niveau: {insights.lastDossier.readiness_level}
              </Text>
              <View style={{ height: Tokens.space.md }} />
              <ActionButton
                title="Re-vérifier le dossier"
                variant="ghost"
                onPress={() => router.push("/(tabs)/dossier")}
                track={{ type: "nav", label: "open_dossier", screen: "home" }}
              />
            </>
          ) : (
            <>
              <Text style={styles.body}>Pas encore vérifié. Ajoutez des documents et lancez l’analyse dossier.</Text>
              <View style={{ height: Tokens.space.md }} />
              <ActionButton
                title="Vérifier maintenant"
                onPress={() => router.push("/(tabs)/dossier")}
                track={{ type: "nav", label: "open_dossier", screen: "home" }}
              />
            </>
          )}
        </GlassCard>
      </AnimatedIn>

      <GlassCard>
        <Text style={styles.cardTitle}>Principe “official-only”</Text>
        <Text style={styles.body}>
          L’app ne soumet rien à votre place. Elle guide et vérifie. Les formulaires et paiements restent sur les portails
          officiels.
        </Text>
        <View style={{ height: Tokens.space.md }} />
        <ActionButton
          title="Vérifier une URL (anti-scam)"
          onPress={() => router.push("/(tabs)/security")}
          variant="ghost"
          track={{ type: "nav", label: "open_security", screen: "home" }}
        />
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Profil</Text>
        <Text style={styles.body}>
          {profile ? `${profile.nationality} · ${profile.age} ans · ${profile.profession}` : "Aucun profil"}
        </Text>
        <View style={{ height: Tokens.space.md }} />
        <ActionButton
          title="Réinitialiser le profil"
          variant="ghost"
          onPress={async () => {
            await clearProfile();
            router.replace("/onboarding");
          }}
          track={{ type: "profile", label: "clear_profile", screen: "home" }}
        />
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: {
    color: Colors.text,
    fontSize: Tokens.font.size.lg,
    fontWeight: Tokens.font.weight.bold,
  },
  body: {
    marginTop: Tokens.space.sm,
    color: Colors.muted,
    fontSize: Tokens.font.size.md,
    lineHeight: 22,
  },
  bulletRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: Tokens.space.sm,
    alignItems: "flex-start",
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
    marginTop: 6,
    backgroundColor: Colors.brandA,
  },
  bulletText: {
    flex: 1,
    color: Colors.muted,
    fontSize: Tokens.font.size.md,
    lineHeight: 22,
  },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  ctaRow: { flexDirection: "row", gap: 10 },
  warn: { color: Colors.warning, fontSize: Tokens.font.size.sm, lineHeight: 20 },
});
