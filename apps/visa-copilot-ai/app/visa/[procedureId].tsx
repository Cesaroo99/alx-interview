import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { Api, type ProcedureTimelineResponse } from "@/src/api/client";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";
import { useDocuments } from "@/src/state/documents";
import { useInsights } from "@/src/state/insights";
import { useProfile } from "@/src/state/profile";
import { useVisaTimeline } from "@/src/state/visa_timeline";

function statusTone(s: string) {
  const x = String(s || "").toLowerCase();
  if (x.includes("blocked")) return Colors.danger;
  if (x.includes("in progress")) return Colors.warning;
  if (x.includes("completed")) return Colors.success;
  return Colors.faint;
}

function actionToRoute(actionKey?: string | null) {
  const k = String(actionKey || "");
  if (k === "open_eligibility") return "/(tabs)/eligibility";
  if (k === "open_documents") return "/(tabs)/documents";
  if (k === "open_travel") return "/tools/travel";
  if (k === "open_costs") return "/tools/costs";
  if (k === "open_appointments") return "/(tabs)/appointments";
  if (k === "open_forms") return "/tools/forms";
  if (k === "open_portals") return "/tools/portals";
  if (k === "open_dossier") return "/(tabs)/dossier";
  if (k === "open_final_check") return "/tools/final_check";
  return null;
}

export default function VisaJourneyScreen() {
  const params = useLocalSearchParams<{ procedureId?: string }>();
  const procedureId = String(params?.procedureId || "").trim();
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const { profile } = useProfile();
  const { docs } = useDocuments();
  const { insights } = useInsights();
  const { state: timelineState, toggleProcedureStep, setActiveProcedureId } = useVisaTimeline();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProcedureTimelineResponse | null>(null);
  const [activeStepId, setActiveStepId] = useState<string>("");

  const visaCase = useMemo(() => (timelineState.visas || []).find((v) => v.id === procedureId) || null, [procedureId, timelineState.visas]);

  useEffect(() => {
    if (procedureId) void setActiveProcedureId(procedureId);
  }, [procedureId, setActiveProcedureId]);

  const ctx = useMemo(() => {
    const d = insights?.lastDossier;
    return {
      destination_region: String(d?.destination_region || profile?.destination_region_hint || visaCase?.country || "Zone Schengen"),
      visa_type: String(d?.visa_type || visaCase?.visaType || "Visa visiteur / tourisme"),
    };
  }, [insights?.lastDossier, profile?.destination_region_hint, visaCase?.country, visaCase?.visaType]);

  const payloadDocs = useMemo(
    () =>
      (docs || []).map((d) => ({
        doc_id: d.id,
        doc_type: d.doc_type,
        filename: d.filename,
        extracted: d.extracted || {},
      })),
    [docs]
  );

  const manualCompleted = useMemo(() => {
    if (!procedureId) return [];
    return (timelineState.procedure || {})[procedureId]?.completedStepIds || [];
  }, [procedureId, timelineState.procedure]);

  const signals = useMemo(() => {
    const events = timelineState.events || [];
    const hasCost = events.some((e) => e.meta?.cost_engine || String(e.title || "").toLowerCase().includes("estimation des coûts"));
    const hasTravel = events.some((e) => String(e.title || "").toLowerCase().includes("départ (itinéraire)")) && events.some((e) => String(e.title || "").toLowerCase().includes("retour (itinéraire)"));
    const hasAppointment = events.some((e) => e.type === "appointment" || e.type === "biometrics");
    return {
      travel_plan_ready: hasTravel,
      costs_ready: hasCost,
      appointment_ready: hasAppointment,
    };
  }, [timelineState.events]);

  async function run() {
    if (!procedureId) {
      setError("ID de procédure manquant.");
      return;
    }
    if (!profile) {
      setError("Profil requis.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await Api.procedureTimeline({
        profile,
        destination_region: ctx.destination_region,
        visa_type: ctx.visa_type,
        documents: payloadDocs,
        signals: {
          travel_plan_ready: signals.travel_plan_ready,
          costs_ready: signals.costs_ready,
          appointment_ready: signals.appointment_ready,
          manual_completed_step_ids: manualCompleted,
        },
      });
      setData(res);
      const first = (res.A_timeline_view || [])[0];
      if (!activeStepId && first?.id) setActiveStepId(String(first.id));
      const next = (res.A_timeline_view || []).find((s) => String(s.status).toLowerCase().includes("in progress")) || (res.A_timeline_view || []).find((s) => String(s.status).toLowerCase().includes("not started"));
      if (!activeStepId && next?.id) setActiveStepId(String(next.id));
    } catch (e: any) {
      setError(String(e?.message || e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [procedureId, ctx.destination_region, ctx.visa_type, payloadDocs.length, manualCompleted.length]);

  const steps = useMemo(() => data?.A_timeline_view || [], [data?.A_timeline_view]);
  const activeStep = useMemo(() => steps.find((s) => String(s.id) === String(activeStepId)) || steps[0] || null, [steps, activeStepId]);

  const progress = useMemo(() => {
    const total = steps.length || 0;
    const done = steps.filter((s) => String(s.status).toLowerCase().includes("completed")).length;
    return { done, total };
  }, [steps]);

  const blockedReason = useMemo(() => {
    if (!activeStep) return null;
    const st = String(activeStep.status || "");
    if (!st.toLowerCase().includes("blocked")) return null;
    const until = (activeStep.blocked_until || []).join(" · ");
    return activeStep.blocked_reason || (until ? `Bloqué jusqu’à: ${until}` : "Bloqué");
  }, [activeStep]);

  return (
    <Screen scroll={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Parcours visa</Text>
        <Text style={styles.subtitle}>
          Procédure: {ctx.destination_region} · {ctx.visa_type} · Progression {progress.done}/{progress.total}
        </Text>
      </View>

      {loading ? (
        <GlassCard>
          <View style={styles.loadingRow}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Chargement de la timeline…</Text>
          </View>
        </GlassCard>
      ) : !profile ? (
        <GlassCard>
          <Text style={styles.body}>Pour ouvrir cette procédure, vous devez d’abord compléter votre profil.</Text>
          <View style={{ height: Tokens.space.md }} />
          <PrimaryButton title="Compléter mon profil" onPress={() => router.push("/profile")} />
        </GlassCard>
      ) : error ? (
        <GlassCard>
          <Text style={styles.error}>{error}</Text>
        </GlassCard>
      ) : data ? (
        <View style={[styles.twoCol, isMobile ? styles.twoColMobile : null]}>
          {/* LEFT 30%: timeline */}
          <View style={[styles.leftCol, isMobile ? styles.colMobile : null]}>
            <GlassCard>
              <Text style={styles.cardTitle}>Timeline</Text>
              <View style={{ height: Tokens.space.sm }} />
              {(steps || []).map((s) => {
                const active = String(s.id) === String(activeStep?.id);
                const tone = statusTone(String(s.status));
                const blocked = String(s.status || "").toLowerCase().includes("blocked");
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => {
                      if (blocked) return;
                      setActiveStepId(String(s.id));
                    }}
                    style={[styles.stepBtn, active ? styles.stepBtnActive : null, blocked ? { opacity: 0.55 } : null]}>
                    <View style={[styles.dot, { backgroundColor: tone }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stepName}>{s.name}</Text>
                      <Text style={styles.stepMeta}>{s.status}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </GlassCard>
          </View>

          {/* RIGHT 70%: active step content */}
          <View style={[styles.rightCol, isMobile ? styles.colMobile : null]}>
            <GlassCard>
              <Text style={styles.cardTitle}>{activeStep?.name || "Étape"}</Text>
              <View style={{ height: Tokens.space.sm }} />
              <Text style={styles.body}>{activeStep?.instruction_now || "—"}</Text>
              {blockedReason ? <Text style={styles.blocked}>{blockedReason}</Text> : null}
              {(activeStep?.estimated_duration || activeStep?.priority) ? (
                <Text style={styles.hint}>
                  {activeStep?.estimated_duration ? `Durée estimée: ${activeStep.estimated_duration}` : ""}
                  {activeStep?.estimated_duration && activeStep?.priority ? " · " : ""}
                  {activeStep?.priority ? `Priorité: ${activeStep.priority}` : ""}
                </Text>
              ) : null}

              <View style={{ height: Tokens.space.md }} />
              <View style={styles.row2}>
                {activeStep?.action_key ? (
                  <PrimaryButton
                    title="Ouvrir l’étape"
                    variant="ghost"
                    onPress={() => {
                      const route = actionToRoute(activeStep.action_key);
                      if (route) router.push(route as any);
                    }}
                    style={{ flex: 1 }}
                  />
                ) : null}
                <PrimaryButton title="Recharger" variant="ghost" onPress={run} style={{ flex: 1 }} />
              </View>

              <View style={{ height: Tokens.space.lg }} />
              <View style={styles.footerCtas}>
                <PrimaryButton title="Enregistrer et quitter" variant="ghost" onPress={() => router.push("/(tabs)")} style={{ flex: 1 }} />
                <PrimaryButton
                  title={blockedReason ? "Bloqué" : "Enregistrer et continuer"}
                  onPress={async () => {
                    if (!activeStep) return;
                    if (blockedReason) return;
                    if (procedureId) await toggleProcedureStep(procedureId, String(activeStep.id));
                    const next = steps.find((s) => !String(s.status).toLowerCase().includes("completed") && !String(s.status).toLowerCase().includes("blocked"));
                    if (next?.id) setActiveStepId(String(next.id));
                    await run();
                  }}
                  style={{ flex: 1, opacity: blockedReason ? 0.6 : 1 }}
                />
              </View>
              {blockedReason ? <Text style={styles.hint}>Bloqué: {blockedReason}</Text> : null}
            </GlassCard>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: Tokens.space.xl, gap: 8 },
  title: { color: Colors.text, fontSize: Tokens.font.size.xxl, fontWeight: Tokens.font.weight.black },
  subtitle: { color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  twoCol: { flex: 1, flexDirection: "row", gap: Tokens.space.lg, paddingHorizontal: Tokens.space.xl, paddingBottom: Tokens.space.xl },
  twoColMobile: { flexDirection: "column", paddingHorizontal: Tokens.space.lg },
  leftCol: { width: "30%" },
  rightCol: { width: "70%" },
  colMobile: { width: "100%" },
  cardTitle: { color: Colors.text, fontSize: Tokens.font.size.lg, fontWeight: Tokens.font.weight.bold },
  body: { color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  hint: { marginTop: Tokens.space.sm, color: Colors.faint, fontSize: Tokens.font.size.sm, lineHeight: 20 },
  blocked: { marginTop: Tokens.space.sm, color: Colors.danger, fontSize: Tokens.font.size.sm, lineHeight: 20 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  loadingText: { color: Colors.muted, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.medium },
  error: { color: Colors.warning, fontSize: Tokens.font.size.md, lineHeight: 22 },
  stepBtn: { flexDirection: "row", gap: 10, paddingVertical: 10, paddingHorizontal: 10, borderRadius: Tokens.radius.lg, alignItems: "center" },
  stepBtnActive: { backgroundColor: "rgba(124,92,255,0.14)", borderWidth: 1, borderColor: "rgba(124,92,255,0.22)" },
  stepName: { color: Colors.text, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.bold, lineHeight: 22 },
  stepMeta: { color: Colors.faint, fontSize: Tokens.font.size.xs, marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 99, marginTop: 2 },
  row2: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  footerCtas: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
});

