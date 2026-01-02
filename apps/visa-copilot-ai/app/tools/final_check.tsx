import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { Api, type FinalCheckResponse } from "@/src/api/client";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";
import { useDocuments } from "@/src/state/documents";
import { useInsights } from "@/src/state/insights";
import { useProfile } from "@/src/state/profile";
import { useVisaTimeline } from "@/src/state/visa_timeline";

function riskDot(r: string) {
  const x = String(r || "").toLowerCase();
  if (x === "high") return Colors.danger;
  if (x === "medium") return Colors.warning;
  return Colors.faint;
}

function actionToRoute(actionKey?: string | null) {
  const k = String(actionKey || "");
  if (k === "open_documents") return "/(tabs)/documents";
  if (k === "open_dossier") return "/(tabs)/dossier";
  if (k === "open_travel") return "/tools/travel";
  if (k === "open_costs") return "/tools/costs";
  if (k === "open_appointments") return "/(tabs)/appointments";
  if (k === "open_portals") return "/tools/portals";
  if (k === "open_forms") return "/tools/forms";
  if (k === "open_refusal_discreet") return "/tools/refusal";
  if (k === "open_eligibility") return "/(tabs)/eligibility";
  return null;
}

export default function FinalCheckScreen() {
  const { profile } = useProfile();
  const { insights } = useInsights();
  const { docs } = useDocuments();
  const { state: timelineState, upsertVisa, toggleFinalCheckFinding } = useVisaTimeline();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FinalCheckResponse | null>(null);
  const [filter, setFilter] = useState<"high" | "all">("high");

  const ctx = useMemo(() => {
    const d = insights?.lastDossier;
    return {
      destination_region: String(d?.destination_region || profile?.destination_region_hint || "Zone Schengen"),
      visa_type: String(d?.visa_type || "Visa visiteur / tourisme"),
    };
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

  const visaIdForThisCase = useMemo(() => {
    const key = `${String(ctx.destination_region).toLowerCase()}__${String(ctx.visa_type)}`.toLowerCase();
    const visa = (timelineState.visas || []).find((v) => `${v.country}__${v.visaType}`.toLowerCase() === key);
    return visa?.id || null;
  }, [ctx.destination_region, ctx.visa_type, timelineState.visas]);

  const completedFindingIds = useMemo(() => {
    const visaId = visaIdForThisCase;
    if (!visaId) return [];
    return (timelineState.finalCheck || {})[visaId]?.completedFindingIds || [];
  }, [timelineState.finalCheck, visaIdForThisCase]);

  const signals = useMemo(() => {
    const events = timelineState.events || [];
    const hasCost = events.some((e) => e.meta?.cost_engine || String(e.title || "").toLowerCase().includes("estimation coûts"));
    const costUnknown = events
      .map((e) => e.meta?.cost_engine?.totals?.unknown_count)
      .filter((x) => typeof x === "number")[0] as number | undefined;
    const suspiciousHigh = events
      .flatMap((e) => e.meta?.cost_engine?.suspicious_fees_alerts || [])
      .filter((a: any) => String(a?.risk_level || "").toLowerCase() === "high").length;
    const hasTravel = events.some((e) => String(e.title || "").toLowerCase().includes("départ (itinéraire)")) && events.some((e) => String(e.title || "").toLowerCase().includes("retour (itinéraire)"));
    const hasAppointment = events.some((e) => e.type === "appointment" || e.type === "biometrics");
    const overlap = 0; // MVP: overlap computed in travel screen; here keep 0
    return {
      travel_signals: { travel_plan_ready: hasTravel, travel_high_risks: 0 },
      cost_signals: { costs_ready: hasCost, unknown_count: costUnknown || 0, suspicious_fees_high: suspiciousHigh },
      timeline_signals: { appointment_ready: hasAppointment, overlap_conflicts: overlap },
    };
  }, [timelineState.events]);

  async function run() {
    if (!profile) {
      setError("Profil requis.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await Api.finalCheck({
        profile,
        destination_region: ctx.destination_region,
        visa_type: ctx.visa_type,
        documents: payloadDocs,
        travel_signals: signals.travel_signals,
        cost_signals: signals.cost_signals,
        timeline_signals: signals.timeline_signals,
        completed_finding_ids: completedFindingIds,
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
  }, [ctx.destination_region, ctx.visa_type, payloadDocs.length, completedFindingIds.length]);

  const findings = useMemo(() => {
    const xs = data?.B_detailed_findings || [];
    const filtered = filter === "high" ? xs.filter((x) => String(x.risk_level).toLowerCase() === "high" && x.status === "Pending") : xs;
    return filtered.slice(0, 40);
  }, [data?.B_detailed_findings, filter]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Vérification finale</Text>
        <Text style={styles.subtitle}>Dernier contrôle avant soumission: cohérence, pièces, itinéraire, coûts, RDV.</Text>
      </View>

      {loading ? (
        <GlassCard>
          <View style={styles.loadingRow}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Analyse finale…</Text>
          </View>
        </GlassCard>
      ) : error ? (
        <GlassCard>
          <Text style={styles.error}>{error}</Text>
        </GlassCard>
      ) : data ? (
        <>
          <GlassCard>
            <Text style={styles.cardTitle}>A. Résumé du dossier</Text>
            <View style={{ height: Tokens.space.sm }} />
            <Text style={styles.body}>Statut: {data.A_dossier_summary.readiness_status}</Text>
            <Text style={styles.body}>
              Checks: {data.A_dossier_summary.total_checks} · High: {data.A_dossier_summary.high_risks} · Medium: {data.A_dossier_summary.medium_risks} · Low:{" "}
              {data.A_dossier_summary.low_risks}
            </Text>
            <View style={{ height: Tokens.space.md }} />
            <View style={styles.row2}>
              <PrimaryButton title="Corriger High" variant={filter === "high" ? "brand" : "ghost"} onPress={() => setFilter("high")} style={{ flex: 1 }} />
              <PrimaryButton title="Voir tout" variant={filter === "all" ? "brand" : "ghost"} onPress={() => setFilter("all")} style={{ flex: 1 }} />
              <PrimaryButton title="Relancer" variant="ghost" onPress={run} style={{ flex: 1 }} />
            </View>
          </GlassCard>

          <GlassCard>
            <Text style={styles.cardTitle}>C. Prochaines étapes</Text>
            {(data.C_next_steps_summary.what_to_do_now || []).slice(0, 6).map((x) => (
              <View key={x} style={styles.bulletRow}>
                <View style={[styles.dot, { backgroundColor: Colors.brandB }]} />
                <Text style={styles.text}>{x}</Text>
              </View>
            ))}
            {(data.C_next_steps_summary.what_is_blocked || []).slice(0, 6).map((x) => (
              <View key={x} style={styles.bulletRow}>
                <View style={[styles.dot, { backgroundColor: Colors.faint }]} />
                <Text style={styles.text}>{x}</Text>
              </View>
            ))}
          </GlassCard>

          <GlassCard>
            <Text style={styles.cardTitle}>B. Constats détaillés</Text>
            <View style={{ height: Tokens.space.sm }} />
            {findings.map((f) => {
              const dot = riskDot(f.risk_level);
              const actionKey = f.action?.action_key;
              const route = actionToRoute(actionKey);
              return (
                <View key={f.id} style={styles.findingCard}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.findingTitle}>{f.issue}</Text>
                    <Text style={styles.pill}>{f.risk_level}</Text>
                  </View>
                  <Text style={styles.note}>{f.description}</Text>
                  <Text style={styles.note}>Action: {f.suggested_action}</Text>
                  <Text style={styles.hint}>Statut: {f.status} · Priorité: {f.priority}</Text>
                  <View style={{ height: Tokens.space.sm }} />
                  <View style={styles.row2}>
                    <PrimaryButton
                      title={f.status === "Completed" ? "Réouvrir" : "Marquer fait"}
                      variant="ghost"
                      onPress={async () => {
                        const visaId = visaIdForThisCase || (await upsertVisa({ country: ctx.destination_region, visaType: ctx.visa_type, objective: "visa", stage: "application" }));
                        await toggleFinalCheckFinding(visaId, f.id);
                        await run();
                      }}
                      style={{ flex: 1 }}
                    />
                    {route ? <PrimaryButton title="Ouvrir" onPress={() => router.push(route as any)} style={{ flex: 1 }} /> : null}
                    {actionKey === "open_document_edit" ? (
                      <PrimaryButton title="Doc" variant="ghost" onPress={() => router.push({ pathname: "/documents/edit", params: f.action?.params } as any)} style={{ flex: 1 }} />
                    ) : null}
                    {actionKey === "open_document_add" ? (
                      <PrimaryButton title="Ajouter" variant="ghost" onPress={() => router.push({ pathname: "/documents/add", params: f.action?.params } as any)} style={{ flex: 1 }} />
                    ) : null}
                  </View>
                  <View style={[styles.dot, { backgroundColor: dot, marginTop: 10 }]} />
                </View>
              );
            })}
          </GlassCard>

          <GlassCard>
            <Text style={styles.cardTitle}>Votre choix</Text>
            <Text style={styles.body}>{data.final_user_prompt}</Text>
            <View style={{ height: Tokens.space.md }} />
            <View style={styles.row2}>
              <PrimaryButton title="1) Corriger High" onPress={() => setFilter("high")} style={{ flex: 1 }} />
              <PrimaryButton title="2) Medium/Low" variant="ghost" onPress={() => setFilter("all")} style={{ flex: 1 }} />
              <PrimaryButton title="3) Rapport readiness" variant="ghost" onPress={() => router.push("/tools/forms")} style={{ flex: 1 }} />
            </View>
          </GlassCard>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 8 },
  title: { color: Colors.text, fontSize: Tokens.font.size.xxl, fontWeight: Tokens.font.weight.black },
  subtitle: { color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  cardTitle: { color: Colors.text, fontSize: Tokens.font.size.lg, fontWeight: Tokens.font.weight.bold },
  body: { marginTop: Tokens.space.sm, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  loadingText: { color: Colors.muted, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.medium },
  error: { color: Colors.warning, fontSize: Tokens.font.size.md, lineHeight: 22 },
  row2: { flexDirection: "row", gap: 10, marginTop: 8, flexWrap: "wrap" },
  bulletRow: { flexDirection: "row", gap: 10, marginTop: Tokens.space.sm, alignItems: "flex-start" },
  dot: { width: 10, height: 10, borderRadius: 99 },
  text: { flex: 1, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  findingCard: { marginTop: Tokens.space.md, padding: Tokens.space.md, borderRadius: Tokens.radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card2 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  findingTitle: { flex: 1, color: Colors.text, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.bold, lineHeight: 22 },
  note: { marginTop: 6, color: Colors.faint, fontSize: Tokens.font.size.sm, lineHeight: 20 },
  hint: { marginTop: 6, color: Colors.faint, fontSize: Tokens.font.size.sm, lineHeight: 20 },
  pill: { color: Colors.text, fontSize: Tokens.font.size.sm, fontWeight: Tokens.font.weight.semibold },
});

