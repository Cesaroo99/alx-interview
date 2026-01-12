import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { Api, type ProcedureTimelineResponse } from "@/src/api/client";
import { useColors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { useTypeScale } from "@/src/theme/typography";
import { AnimatedIn } from "@/src/ui/AnimatedIn";
import { Badge } from "@/src/ui/Badge";
import { GlassCard } from "@/src/ui/GlassCard";
import { HeroBanner } from "@/src/ui/HeroBanner";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { ProgressBar } from "@/src/ui/ProgressBar";
import { Screen } from "@/src/ui/Screen";
import { SkeletonCard } from "@/src/ui/Skeleton";
import { ScorePill } from "@/src/ui/ScorePill";
import { useDocuments } from "@/src/state/documents";
import { useInsights } from "@/src/state/insights";
import { useProfile } from "@/src/state/profile";
import { useVisaTimeline } from "@/src/state/visa_timeline";

export default function HomeScreen() {
  const colors = useColors();
  const type = useTypeScale();
  const { profile, clearProfile } = useProfile();
  const { docs } = useDocuments();
  const { insights, setLastDiagnostic } = useInsights();
  const { state: timelineState, upsertVisa, setActiveProcedureId } = useVisaTimeline();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [journeyLoading, setJourneyLoading] = useState(false);
  const [journey, setJourney] = useState<ProcedureTimelineResponse | null>(null);

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

  const activeVisa = useMemo(() => {
    const visas = timelineState.visas || [];
    if (!visas.length) return null;
    return visas.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0] || null;
  }, [timelineState.visas]);

  const activeProcedureId = useMemo(() => {
    const fromState = String(timelineState.activeProcedureId || "").trim();
    if (fromState) return fromState;
    return activeVisa?.id || null;
  }, [activeVisa?.id, timelineState.activeProcedureId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!profile || !activeProcedureId) return;
      setJourneyLoading(true);
      try {
        const payloadDocs = (docs || []).map((d) => ({ doc_id: d.id, doc_type: d.doc_type, filename: d.filename, extracted: d.extracted || {} }));
        const manualCompleted = (timelineState.procedure || {})[activeProcedureId]?.completedStepIds || [];
        const events = timelineState.events || [];
        const hasCost = events.some((e) => e.meta?.cost_engine || String(e.title || "").toLowerCase().includes("estimation des coûts"));
        const hasTravel =
          events.some((e) => String(e.title || "").toLowerCase().includes("départ (itinéraire)")) &&
          events.some((e) => String(e.title || "").toLowerCase().includes("retour (itinéraire)"));
        const hasAppointment = events.some((e) => e.type === "appointment" || e.type === "biometrics");
        const res = await Api.procedureTimeline({
          profile,
          destination_region: String(insights?.lastDossier?.destination_region || profile.destination_region_hint || activeVisa?.country || "Zone Schengen"),
          visa_type: String(insights?.lastDossier?.visa_type || activeVisa?.visaType || "Visa visiteur / tourisme"),
          documents: payloadDocs,
          signals: { travel_plan_ready: hasTravel, costs_ready: hasCost, appointment_ready: hasAppointment, manual_completed_step_ids: manualCompleted },
        });
        if (!cancelled) setJourney(res);
      } catch {
        if (!cancelled) setJourney(null);
      } finally {
        if (!cancelled) setJourneyLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    activeProcedureId,
    activeVisa?.country,
    activeVisa?.visaType,
    docs,
    insights?.lastDossier?.destination_region,
    insights?.lastDossier?.visa_type,
    profile,
    timelineState.events,
    timelineState.procedure,
  ]);

  const procedureProgress = useMemo(() => {
    const steps = journey?.A_timeline_view || [];
    const total = steps.length || 0;
    const done = steps.filter((s) => String(s.status || "").toLowerCase().includes("completed")).length;
    const blocked = steps.filter((s) => String(s.status || "").toLowerCase().includes("blocked"));
    const warnings = steps.filter((s) => String(s.status || "").toLowerCase().includes("in progress"));
    const next =
      steps.find((s) => String(s.status || "").toLowerCase().includes("in progress")) ||
      steps.find((s) => !String(s.status || "").toLowerCase().includes("completed") && !String(s.status || "").toLowerCase().includes("blocked")) ||
      null;
    return { done, total, blocked, warnings, next };
  }, [journey]);

  const nextActionLabel = useMemo(() => {
    if (!procedureProgress.next) return null;
    return String(procedureProgress.next.instruction_now || procedureProgress.next.name || "").trim() || null;
  }, [procedureProgress.next]);

  const completion = useMemo(() => {
    const total = 5;
    let done = 0;
    if (profile?.nationality && profile?.profession && Number.isFinite(profile.age) && profile?.country_of_residence) done += 1;
    if (profile?.destination_region_hint) done += 1;
    if (docs.some((d) => d.doc_type === "passport")) done += 1;
    if (docs.some((d) => d.doc_type === "bank_statement")) done += 1;
    if (insights.lastDossier) done += 1;
    return { done, total };
  }, [profile, docs, insights.lastDossier]);

  const criticalAlerts = useMemo(() => {
    const alerts: string[] = [];
    if (!profile) alerts.push("Profil incomplet: complétez votre profil.");
    if (profile && (!profile.nationality || !profile.profession || !profile.country_of_residence || !Number.isFinite(profile.age))) {
      alerts.push("Profil incomplet: certaines infos bloquent la procédure.");
    }
    if (!docs.some((d) => d.doc_type === "passport")) alerts.push("Passeport manquant: ajoutez-le dans Documents.");
    if (insights.lastDossier?.readiness_level === "not_ready") alerts.push("Dossier: pas prêt. Corrigez avant dépôt.");
    if (procedureProgress.blocked.length) {
      alerts.push(`Étapes bloquées: ${procedureProgress.blocked.slice(0, 2).map((s) => s.name).join(" · ")}.`);
    }
    return alerts.slice(0, 4);
  }, [profile, docs, insights.lastDossier?.readiness_level, procedureProgress.blocked]);

  return (
    <Screen>
      <HeroBanner
        kicker="Visa Copilot AI"
        title="Tableau de bord"
        subtitle="Progression de procédure, blocages, alertes et prochaine action."
      />

      <AnimatedIn delayMs={0}>
        <GlassCard>
          <View style={styles.rowTop}>
            <Text style={[styles.cardTitle, type.h3, { color: colors.text }]}>Progression</Text>
            <Badge
              label={`${completion.done}/${completion.total}`}
              tone={completion.done === completion.total ? "success" : completion.done >= 3 ? "warning" : "danger"}
            />
          </View>
          <View style={{ height: Tokens.space.sm }} />
          <ProgressBar step={completion.done} total={completion.total} />
          <Text style={[styles.body, type.body, { color: colors.muted }]}>
            {profile ? `${profile.nationality} · ${profile.age} ans · ${profile.profession}` : "Aucun profil"}
          </Text>
          <View style={{ height: Tokens.space.md }} />
          <View style={styles.ctaRow}>
            <PrimaryButton
              title={activeProcedureId ? "Continuer le parcours visa" : "Démarrer une procédure"}
              onPress={async () => {
                if (!profile) {
                  router.push("/profile");
                  return;
                }
                if (!activeProcedureId) {
                  const visaId = await upsertVisa({
                    country: String(profile.destination_region_hint || "Zone Schengen"),
                    visaType: "Visa visiteur / tourisme",
                    objective: "visa",
                    stage: "application",
                  });
                  await setActiveProcedureId(visaId);
                  router.push(`/visa/${visaId}` as any);
                  return;
                }
                await setActiveProcedureId(activeProcedureId);
                router.push(`/visa/${activeProcedureId}` as any);
              }}
              style={{ flex: 1 }}
            />
            <PrimaryButton title="Documents" variant="ghost" onPress={() => router.push("/(tabs)/documents")} style={{ flex: 1 }} />
          </View>
          {activeProcedureId && nextActionLabel ? (
            <Text style={[styles.body, type.body, { color: colors.muted }]}>Prochaine action recommandée: {nextActionLabel}</Text>
          ) : null}
        </GlassCard>
      </AnimatedIn>

      <AnimatedIn delayMs={90}>
        <GlassCard>
          <Text style={[styles.cardTitle, type.h3, { color: colors.text }]}>Alertes critiques</Text>
          <View style={{ height: Tokens.space.sm }} />
          {criticalAlerts.length ? (
            criticalAlerts.map((a) => (
              <View key={a} style={styles.bulletRow}>
                <View style={[styles.bulletDot, { backgroundColor: colors.danger }]} />
                <Text style={[styles.bulletText, type.body, { color: colors.muted }]}>{a}</Text>
              </View>
            ))
          ) : (
            <Text style={[styles.body, type.body, { color: colors.muted }]}>Aucune alerte critique détectée.</Text>
          )}
        </GlassCard>
      </AnimatedIn>

      <AnimatedIn delayMs={130}>
        <GlassCard>
          <View style={styles.rowTop}>
            <Text style={[styles.cardTitle, type.h3, { color: colors.text }]}>Procédure visa</Text>
            {journeyLoading ? <ActivityIndicator /> : null}
          </View>
          <Text style={[styles.body, type.body, { color: colors.muted }]}>Suivi par étapes, avec raisons de blocage et prochaines actions.</Text>
          <View style={{ height: Tokens.space.md }} />
          {activeProcedureId ? (
            <>
              <Text style={[styles.body, type.body, { color: colors.muted }]}>
                Avancement: {procedureProgress.done}/{procedureProgress.total} · Bloqués: {procedureProgress.blocked.length} · En cours: {procedureProgress.warnings.length}
              </Text>
              <View style={{ height: Tokens.space.md }} />
              <View style={styles.ctaRow}>
                <PrimaryButton
                  title="Ouvrir le parcours visa"
                  onPress={async () => {
                    await setActiveProcedureId(activeProcedureId);
                    router.push(`/visa/${activeProcedureId}` as any);
                  }}
                  style={{ flex: 1 }}
                />
                <PrimaryButton title="Vérif finale" variant="ghost" onPress={() => router.push("/tools/final_check")} style={{ flex: 1 }} />
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.body, type.body, { color: colors.muted }]}>
                Aucune procédure active. Démarrez pour obtenir une timeline et des actions guidées.
              </Text>
              <View style={{ height: Tokens.space.md }} />
              <PrimaryButton
                title="Démarrer une procédure"
                onPress={async () => {
                  if (!profile) {
                    router.push("/profile");
                    return;
                  }
                  const visaId = await upsertVisa({
                    country: String(profile.destination_region_hint || "Zone Schengen"),
                    visaType: "Visa visiteur / tourisme",
                    objective: "visa",
                    stage: "application",
                  });
                  await setActiveProcedureId(visaId);
                  router.push(`/visa/${visaId}` as any);
                }}
              />
            </>
          )}
        </GlassCard>
      </AnimatedIn>

      <AnimatedIn delayMs={160}>
        <GlassCard>
          <View style={styles.rowTop}>
            <Text style={[styles.cardTitle, type.h3, { color: colors.text }]}>Dernier diagnostic</Text>
            {loading ? <ActivityIndicator /> : null}
          </View>
          <View style={{ height: Tokens.space.md }} />
          {error ? (
            <Text style={[styles.warn, { color: colors.warning }]}>API indisponible (affichage des derniers résultats si disponibles).</Text>
          ) : null}
          {loading && !insights.lastDiagnostic ? (
            <SkeletonCard />
          ) : insights.lastDiagnostic ? (
            <>
              <ScorePill label="Readiness" value={insights.lastDiagnostic.readiness_score} />
              <View style={{ height: Tokens.space.sm }} />
              <ScorePill label="Risque refus" value={insights.lastDiagnostic.refusal_risk_score} kind="risk" />
              <View style={{ height: Tokens.space.lg }} />
              <PrimaryButton title="Ouvrir le diagnostic" onPress={() => router.push("/(tabs)/diagnostic")} />
            </>
          ) : (
            <Text style={[styles.body, type.body, { color: colors.muted }]}>Lancez un diagnostic pour voir vos scores.</Text>
          )}
        </GlassCard>
      </AnimatedIn>

      <AnimatedIn delayMs={220}>
        <GlassCard>
          <Text style={[styles.cardTitle, type.h3, { color: colors.text }]}>Dernier score dossier</Text>
          <View style={{ height: Tokens.space.md }} />
          {insights.lastDossier ? (
            <>
              <ScorePill label="Readiness dossier" value={insights.lastDossier.readiness_score} />
              <View style={{ height: Tokens.space.sm }} />
              <Text style={[styles.body, type.body, { color: colors.muted }]}>
                Cohérence: {Math.round(insights.lastDossier.coherence_score)}/100 · Niveau: {insights.lastDossier.readiness_level}
              </Text>
              <View style={{ height: Tokens.space.md }} />
              <PrimaryButton title="Re-vérifier le dossier" variant="ghost" onPress={() => router.push("/(tabs)/dossier")} />
            </>
          ) : (
            <>
              <Text style={[styles.body, type.body, { color: colors.muted }]}>
                Pas encore vérifié. Ajoutez des documents et lancez l’analyse dossier.
              </Text>
              <View style={{ height: Tokens.space.md }} />
              <PrimaryButton title="Vérifier maintenant" onPress={() => router.push("/(tabs)/dossier")} />
            </>
          )}
        </GlassCard>
      </AnimatedIn>

      <GlassCard>
        <Text style={[styles.cardTitle, type.h3, { color: colors.text }]}>Principe “official-only”</Text>
        <Text style={[styles.body, type.body, { color: colors.muted }]}>
          L’app ne soumet rien à votre place. Elle guide et vérifie. Les formulaires et paiements restent sur les portails
          officiels.
        </Text>
        <View style={{ height: Tokens.space.md }} />
        <PrimaryButton title="Vérifier une URL (anti-scam)" onPress={() => router.push("/(tabs)/security")} variant="ghost" />
      </GlassCard>

      <GlassCard>
        <Text style={[styles.cardTitle, type.h3, { color: colors.text }]}>Profil</Text>
        <Text style={[styles.body, type.body, { color: colors.muted }]}>
          {profile ? `${profile.nationality} · ${profile.age} ans · ${profile.profession}` : "Aucun profil"}
        </Text>
        <View style={{ height: Tokens.space.md }} />
        <PrimaryButton
          title="Réinitialiser le profil"
          variant="ghost"
          onPress={async () => {
            await clearProfile();
            router.replace("/onboarding");
          }}
        />
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: {},
  body: { marginTop: Tokens.space.sm },
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
  },
  bulletText: {
    flex: 1,
  },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  ctaRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  warn: { fontSize: Tokens.font.size.sm, lineHeight: 20 },
});
