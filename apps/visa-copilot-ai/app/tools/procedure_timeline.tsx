import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

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

function statusColor(status: string) {
  const s = String(status || "").toLowerCase();
  if (s.includes("blocked")) return Colors.warning;
  if (s.includes("completed")) return Colors.brandB;
  if (s.includes("in progress")) return Colors.brandA;
  return Colors.faint;
}

function actionToRoute(actionKey?: string | null) {
  const k = String(actionKey || "");
  if (k === "open_documents") return "/(tabs)/documents";
  if (k === "open_dossier") return "/(tabs)/dossier";
  if (k === "open_travel") return "/tools/travel";
  if (k === "open_costs") return "/tools/costs";
  if (k === "open_forms") return "/tools/forms";
  if (k === "open_portals") return "/tools/portals";
  if (k === "open_appointments") return "/(tabs)/appointments";
  if (k === "open_eligibility") return "/(tabs)/eligibility";
  return null;
}

export default function ProcedureTimelineScreen() {
  const { profile } = useProfile();
  const { insights } = useInsights();
  const { docs } = useDocuments();
  const { state: timelineState, upsertVisa, toggleProcedureStep, addManualEvent, markProcedureAutoCreated } = useVisaTimeline();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProcedureTimelineResponse | null>(null);
  const [mode, setMode] = useState<"all" | "blocked" | "next">("next");

  const ctx = useMemo(() => {
    const d = insights?.lastDossier;
    const destination_region = String(d?.destination_region || profile?.destination_region_hint || "Zone Schengen");
    const visa_type = String(d?.visa_type || "Visa visiteur / tourisme");
    return { destination_region, visa_type };
  }, [insights?.lastDossier, profile?.destination_region_hint]);

  const payloadDocs = useMemo(
    () =>
      (docs || []).map((d) => ({
        doc_id: d.id,
        doc_type: d.doc_type,
        extracted: d.extracted || {},
      })),
    [docs]
  );

  const signals = useMemo(() => {
    const events = timelineState.events || [];
    const hasCost = events.some((e) => e.meta?.cost_engine || String(e.title || "").toLowerCase().includes("estimation coûts"));
    const hasTravel = events.some((e) => String(e.title || "").toLowerCase().includes("départ (itinéraire)")) && events.some((e) => String(e.title || "").toLowerCase().includes("retour (itinéraire)"));
    const hasAppointment = events.some((e) => e.type === "appointment" || e.type === "biometrics");
    const hasSubmission = events.some((e) => e.type === "submission" || String(e.title || "").toLowerCase().includes("soumission"));
    const dossierReady = !!insights?.lastDossier && Number(insights.lastDossier.readiness_score || 0) > 0;
    return {
      dossier_ready: dossierReady,
      travel_plan_ready: hasTravel,
      costs_ready: hasCost,
      appointment_ready: hasAppointment,
      submission_started: hasSubmission,
    };
  }, [insights?.lastDossier, timelineState.events]);

  const manualCompleted = useMemo(() => {
    // tie to current visaId key
    const key = `${String(ctx.destination_region).toLowerCase()}__${String(ctx.visa_type)}`.toLowerCase();
    const visa = (timelineState.visas || []).find((v) => `${v.country}__${v.visaType}`.toLowerCase() === key);
    if (!visa) return [];
    return (timelineState.procedure || {})[visa.id]?.completedStepIds || [];
  }, [ctx.destination_region, ctx.visa_type, timelineState.procedure, timelineState.visas]);

  const visaIdForThisCase = useMemo(() => {
    const key = `${String(ctx.destination_region).toLowerCase()}__${String(ctx.visa_type)}`.toLowerCase();
    const visa = (timelineState.visas || []).find((v) => `${v.country}__${v.visaType}`.toLowerCase() === key);
    return visa?.id || null;
  }, [ctx.destination_region, ctx.visa_type, timelineState.visas]);

  async function run() {
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
        signals,
        manual_completed_step_ids: manualCompleted,
      });
      setData(res);
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
  }, [ctx.destination_region, ctx.visa_type, payloadDocs.length]);

  // Auto-planification: créer des tâches (sans date) quand une étape devient actionnable.
  useEffect(() => {
    (async () => {
      if (!data || !profile) return;
      const visaId = visaIdForThisCase || (await upsertVisa({ country: ctx.destination_region, visaType: ctx.visa_type, objective: "visa", stage: "application" }));
      const proc = (timelineState.procedure || {})[visaId] || { completedStepIds: [], autoCreatedStepIds: [], updatedAt: Date.now() };
      const already = new Set((proc.autoCreatedStepIds || []).map((x) => String(x)));

      const actionable = (data.A_timeline_view || []).filter((s) => {
        const st = String(s.status || "").toLowerCase();
        return st === "not started" || st === "in progress";
      });

      for (const s of actionable.slice(0, 6)) {
        if (already.has(s.id)) continue;
        const events = (s.suggested_events || []).slice(0, 1);
        const e0 = events[0];
        if (!e0) continue;
        await addManualEvent({
          visaId,
          type: (e0.type as any) || "other",
          title: e0.title || `Procédure: ${s.name}`,
          notes: e0.notes || s.instruction_now,
          meta: { procedure_step_id: s.id, procedure_step_name: s.name },
        });
        await markProcedureAutoCreated(visaId, s.id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.A_timeline_view?.length, visaIdForThisCase]);

  const steps = useMemo(() => data?.A_timeline_view || [], [data?.A_timeline_view]);
  const filtered = useMemo(() => {
    if (mode === "all") return steps;
    if (mode === "blocked") return steps.filter((s) => String(s.status).toLowerCase().includes("blocked"));
    // next
    const ready = steps.filter((s) => ["not started", "in progress"].includes(String(s.status).toLowerCase()));
    return ready.slice(0, 5);
  }, [mode, steps]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Timeline procédure (dynamique)</Text>
        <Text style={styles.subtitle}>Statuts, blocages, dépendances, et actions. Mise à jour automatique selon vos modules.</Text>
      </View>

      <GlassCard>
        <Text style={styles.cardTitle}>B. Next Action Summary</Text>
        <View style={{ height: Tokens.space.sm }} />
        <View style={styles.row2}>
          <PrimaryButton title="Focus next" variant={mode === "next" ? "brand" : "ghost"} onPress={() => setMode("next")} style={{ flex: 1 }} />
          <PrimaryButton title="Voir bloqués" variant={mode === "blocked" ? "brand" : "ghost"} onPress={() => setMode("blocked")} style={{ flex: 1 }} />
          <PrimaryButton title="Tout" variant={mode === "all" ? "brand" : "ghost"} onPress={() => setMode("all")} style={{ flex: 1 }} />
        </View>
        <View style={{ height: Tokens.space.sm }} />
        {(data?.B_next_action_summary || []).slice(0, 6).map((x) => (
          <View key={x} style={styles.bulletRow}>
            <View style={[styles.dot, { backgroundColor: Colors.brandB }]} />
            <Text style={styles.text}>{x}</Text>
          </View>
        ))}
        <View style={{ height: Tokens.space.md }} />
        <PrimaryButton title={loading ? "Mise à jour…" : "Rafraîchir"} variant="ghost" onPress={run} />
      </GlassCard>

      {loading ? (
        <GlassCard>
          <View style={styles.loadingRow}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Génération timeline…</Text>
          </View>
        </GlassCard>
      ) : error ? (
        <GlassCard>
          <Text style={styles.error}>{error}</Text>
        </GlassCard>
      ) : (
        <>
          <GlassCard>
            <Text style={styles.cardTitle}>A. Timeline View</Text>
            <Text style={styles.body}>
              Destination: {ctx.destination_region} · Visa: {ctx.visa_type}
            </Text>
            {filtered.map((s) => {
              const c = statusColor(s.status);
              const route = actionToRoute(s.action_key);
              return (
                <View key={s.id} style={styles.stepCard}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.stepTitle}>{s.name}</Text>
                    <View style={[styles.pill, { borderColor: c }]}>
                      <Text style={[styles.pillText, { color: c }]}>{s.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.note}>
                    {s.blocked_reason ? `Bloqué: ${s.blocked_reason}` : s.instruction_now}
                  </Text>
                  {s.estimated_duration ? <Text style={styles.hint}>Durée estimée: {s.estimated_duration}</Text> : null}
                  {s.blocked_until?.length ? <Text style={styles.hint}>Prérequis: {s.blocked_until.join(" · ")}</Text> : null}
                  <View style={{ height: Tokens.space.sm }} />
                  <View style={styles.row2}>
                    <PrimaryButton
                      title="Marquer / dé-marquer"
                      variant="ghost"
                      onPress={async () => {
                        const visaId = await upsertVisa({ country: ctx.destination_region, visaType: ctx.visa_type, objective: "visa", stage: "application" });
                        await toggleProcedureStep(visaId, s.id);
                        await run();
                      }}
                      style={{ flex: 1 }}
                    />
                    {route ? <PrimaryButton title="Ouvrir" onPress={() => router.push(route as any)} style={{ flex: 1 }} /> : null}
                  </View>

                  {(s.substeps || []).length ? (
                    <>
                      <View style={{ height: Tokens.space.sm }} />
                      <Text style={styles.smallTitle}>Sous-étapes</Text>
                      {(s.substeps || []).slice(0, 4).map((ss) => (
                        <View key={ss.id} style={styles.bulletRow}>
                          <View style={[styles.dot, { backgroundColor: statusColor(ss.status) }]} />
                          <Text style={styles.text}>
                            {ss.name} — {ss.status}
                          </Text>
                        </View>
                      ))}
                    </>
                  ) : null}
                </View>
              );
            })}
          </GlassCard>

          {(data?.C_dependencies || []).length ? (
            <GlassCard>
              <Text style={styles.cardTitle}>C. Dependencies / Prerequisites</Text>
              {(data.C_dependencies || []).map((d) => (
                <View key={d.step_id} style={styles.depRow}>
                  <Text style={styles.stepTitle}>{d.step_name}</Text>
                  <Text style={styles.note}>{d.blocked_reason || "Bloqué"}</Text>
                  <Text style={styles.hint}>Prérequis: {(d.blocked_until || []).join(" · ")}</Text>
                </View>
              ))}
            </GlassCard>
          ) : null}

          <GlassCard>
            <Text style={styles.cardTitle}>Final user prompt</Text>
            <Text style={styles.body}>{data?.final_user_prompt}</Text>
            <View style={{ height: Tokens.space.md }} />
            <View style={styles.row2}>
              <PrimaryButton title="1) Focus next" onPress={() => setMode("next")} style={{ flex: 1 }} />
              <PrimaryButton title="2) Bloqués" variant="ghost" onPress={() => setMode("blocked")} style={{ flex: 1 }} />
              <PrimaryButton
                title="3) Export + rappels"
                variant="ghost"
                onPress={async () => {
                  const visaId = await upsertVisa({ country: ctx.destination_region, visaType: ctx.visa_type, objective: "visa", stage: "application" });
                  const text = (data?.B_next_action_summary || []).join("\n");
                  await addManualEvent({ visaId, type: "other", title: "Export timeline procédure", notes: text, meta: { procedure_timeline: data } });
                  router.push("/(tabs)/appointments");
                }}
                style={{ flex: 1 }}
              />
            </View>
          </GlassCard>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 8 },
  title: { color: Colors.text, fontSize: Tokens.font.size.xxl, fontWeight: Tokens.font.weight.black },
  subtitle: { color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  cardTitle: { color: Colors.text, fontSize: Tokens.font.size.lg, fontWeight: Tokens.font.weight.bold },
  body: { marginTop: Tokens.space.sm, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  row2: { flexDirection: "row", gap: 10, marginTop: 8, flexWrap: "wrap" },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  loadingText: { color: Colors.muted, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.medium },
  error: { color: Colors.warning, fontSize: Tokens.font.size.md, lineHeight: 22 },
  bulletRow: { flexDirection: "row", gap: 10, marginTop: Tokens.space.sm, alignItems: "flex-start" },
  dot: { width: 10, height: 10, borderRadius: 99, marginTop: 6 },
  text: { flex: 1, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  stepCard: { marginTop: Tokens.space.md, padding: Tokens.space.md, borderRadius: Tokens.radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card2 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  stepTitle: { color: Colors.text, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.bold, lineHeight: 22, flex: 1 },
  note: { marginTop: 6, color: Colors.faint, fontSize: Tokens.font.size.sm, lineHeight: 20 },
  hint: { marginTop: 6, color: Colors.faint, fontSize: Tokens.font.size.sm, lineHeight: 20 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  pillText: { fontSize: Tokens.font.size.sm, fontWeight: Tokens.font.weight.semibold },
  smallTitle: { marginTop: Tokens.space.sm, color: Colors.text, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.bold },
  depRow: { marginTop: Tokens.space.md },
});

