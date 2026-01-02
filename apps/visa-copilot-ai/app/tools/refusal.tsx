import React, { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as DocumentPicker from "expo-document-picker";

import { Api, type RefusalAnalyzeResponse } from "@/src/api/client";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";
import { useDocuments } from "@/src/state/documents";
import { useInsights } from "@/src/state/insights";
import { useProfile } from "@/src/state/profile";
import { useVisaTimeline } from "@/src/state/visa_timeline";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T09:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function RefusalCoachScreen() {
  const params = useLocalSearchParams<{ doc_id?: string }>();
  const { profile } = useProfile();
  const { insights } = useInsights();
  const { docs } = useDocuments();
  const { upsertVisa, addManualEvent } = useVisaTimeline();

  const docId = String(params?.doc_id || "").trim();
  const refusalDoc = useMemo(() => (docId ? docs.find((d) => d.id === docId) : null), [docId, docs]);

  const [picked, setPicked] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [transcript, setTranscript] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RefusalAnalyzeResponse | null>(null);
  const [resolved, setResolved] = useState<Record<string, boolean>>({});
  const [followPlanB, setFollowPlanB] = useState<Record<string, boolean>>({});
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [remindersStartIso, setRemindersStartIso] = useState("");

  const activated = useMemo(() => !!picked || !!refusalDoc || transcript.trim().length >= 20, [picked, refusalDoc, transcript]);
  const canRun = useMemo(() => activated && transcript.trim().length >= 30, [activated, transcript]);

  const visaHint = useMemo(() => {
    const d = insights?.lastDossier;
    return {
      country: String(d?.destination_region || profile?.destination_region_hint || "unknown"),
      visaType: String(d?.visa_type || "unknown"),
      objective: String(d?.objective || profile?.travel_purpose || "visa"),
      stage: "application" as const,
    };
  }, [insights, profile]);

  const roadmapText = useMemo(() => {
    if (!result) return "";
    const a = result.A_refusal_summary
      .filter((x) => !resolved[x.reason])
      .map((x) => `- (${x.severity_level}) ${x.reason}: ${x.explanation}`)
      .join("\n");
    const b = result.B_corrective_steps
      .filter((s) => !resolved[s.related_reason])
      .slice(0, 12)
      .map((s, idx) => `${idx + 1}. [${s.priority}] ${s.step}${s.verification_required ? " (preuve requise)" : ""}`)
      .join("\n");
    const c = result.C_plan_b_options
      .filter((x) => followPlanB[x.strategy])
      .map((x) => `- ${x.strategy} | ${x.timeline}`)
      .join("\n");
    return ["A. Refusal Summary", a || "- —", "", "B. Corrective Steps", b || "- —", "", "C. Plan B (sélections)", c || "- —"].join("\n");
  }, [followPlanB, resolved, result]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Analyse confidentielle d’un refus</Text>
        <Text style={styles.subtitle}>
          Ce module est volontairement discret: il ne s’active que si vous téléversez un refus ou collez un transcript/texte.
        </Text>
      </View>

      <GlassCard>
        <Text style={styles.cardTitle}>Entrée (requise)</Text>
        <Text style={styles.body}>
          Importez votre courrier de refus (PDF/image) ou collez un transcript/texte. On extrait les motifs explicites et on propose des actions vérifiables.
        </Text>
        <View style={{ height: Tokens.space.md }} />

        {refusalDoc ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>Document lié au coffre: {refusalDoc.filename}</Text>
            <Text style={styles.noticeText}>Note: l’OCR n’est pas encore branché. Collez le texte/transcript ci‑dessous pour l’extraction.</Text>
          </View>
        ) : null}

        <View style={{ height: Tokens.space.md }} />
        <View style={styles.row2}>
          <PrimaryButton
            title={picked ? `Téléversé: ${picked.name || "document"}` : "Téléverser le refus (PDF/image)"}
            variant="ghost"
            onPress={async () => {
              const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
              if (res.canceled) return;
              setPicked(res.assets[0] || null);
            }}
            style={{ flex: 1 }}
          />
          <PrimaryButton title="Fermer" variant="ghost" onPress={() => router.back()} style={{ flex: 1 }} />
        </View>

        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>Texte / transcript (copié-collé)</Text>
        <TextInput
          value={transcript}
          onChangeText={setTranscript}
          placeholder="Collez ici le texte du refus ou un transcript (évitez les données sensibles si possible)…"
          placeholderTextColor="rgba(16,22,47,0.35)"
          multiline
          style={[styles.input, { minHeight: 120, textAlignVertical: "top" }]}
        />

        <View style={{ height: Tokens.space.lg }} />
        <PrimaryButton
          title={loading ? "Analyse…" : "Analyser"}
          onPress={async () => {
            if (!canRun || loading) return;
            setLoading(true);
            setError(null);
            try {
              const res = await Api.refusalAnalyze({
                profile,
                transcript_text: transcript.trim() || null,
                refusal_letter_text: transcript.trim() || null,
                objective: (insights?.lastDossier as any)?.objective || null,
              });
              setResult(res);
            } catch (e: any) {
              setError(String(e?.message || e));
              setResult(null);
            } finally {
              setLoading(false);
            }
          }}
          style={{ opacity: canRun ? 1 : 0.6 }}
        />
        {!activated ? <Text style={styles.hint}>Pour activer: téléversez un refus ou collez un transcript.</Text> : null}
        {activated && transcript.trim().length < 30 ? <Text style={styles.hint}>Ajoutez un peu plus de texte pour permettre l’extraction des motifs.</Text> : null}
      </GlassCard>

      {loading ? (
        <GlassCard>
          <View style={styles.loadingRow}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Analyse du refus…</Text>
          </View>
        </GlassCard>
      ) : error ? (
        <GlassCard>
          <Text style={styles.error}>{error}</Text>
          <Text style={styles.body}>Astuce: vérifie que l’API est joignable (variable `EXPO_PUBLIC_API_BASE_URL`).</Text>
        </GlassCard>
      ) : result ? (
        <>
          <GlassCard>
            <Text style={styles.cardTitle}>A. Refusal Summary</Text>
            <View style={{ height: Tokens.space.sm }} />
            {(result.A_refusal_summary || []).map((x) => {
              const isResolved = !!resolved[x.reason];
              const color = x.severity_level === "High" ? Colors.danger : x.severity_level === "Medium" ? Colors.warning : Colors.faint;
              return (
                <View key={x.reason} style={[styles.block, { opacity: isResolved ? 0.55 : 1 }]}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.rowTitle}>
                      {x.reason} · sévérité: {x.severity_level}
                    </Text>
                    <PrimaryButton
                      title={isResolved ? "Réactiver" : "Résolu"}
                      variant="ghost"
                      onPress={() => setResolved((p) => ({ ...p, [x.reason]: !p[x.reason] }))}
                    />
                  </View>
                  <View style={[styles.dot, { backgroundColor: color, marginTop: 10 }]} />
                  <Text style={styles.text}>{x.explanation}</Text>
                  {(x.verifiable_factors || []).slice(0, 6).map((f) => (
                    <Text key={f} style={styles.note}>
                      - {f}
                    </Text>
                  ))}
                </View>
              );
            })}
          </GlassCard>

          <GlassCard>
            <Text style={styles.cardTitle}>B. Corrective Steps</Text>
            <View style={{ height: Tokens.space.sm }} />
            {(result.B_corrective_steps || [])
              .filter((s) => !resolved[s.related_reason])
              .slice(0, 16)
              .map((s) => (
                <View key={`${s.related_reason}_${s.step}`} style={styles.bulletRow}>
                  <View style={[styles.dot, { backgroundColor: s.priority === "High" ? Colors.danger : s.priority === "Medium" ? Colors.warning : Colors.faint }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.text}>
                      [{s.priority}] {s.step}
                    </Text>
                    <Text style={styles.note}>
                      Motif: {s.related_reason} · Preuve requise: {s.verification_required ? "Oui" : "Non"}
                    </Text>
                  </View>
                </View>
              ))}
          </GlassCard>

          <GlassCard>
            <Text style={styles.cardTitle}>C. Plan B Options</Text>
            <View style={{ height: Tokens.space.sm }} />
            {(result.C_plan_b_options || []).map((x) => {
              const on = !!followPlanB[x.strategy];
              return (
                <View key={x.strategy} style={styles.block}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.rowTitle}>{x.strategy}</Text>
                    <PrimaryButton title={on ? "Suivi: ON" : "Suivre"} variant={on ? "brand" : "ghost"} onPress={() => setFollowPlanB((p) => ({ ...p, [x.strategy]: !p[x.strategy] }))} />
                  </View>
                  <Text style={styles.note}>Timeline: {x.timeline}</Text>
                  <Text style={styles.note}>{x.alignment_with_user_goals}</Text>
                  <Text style={[styles.note, { marginTop: 8 }]}>Bénéfices:</Text>
                  {(x.benefits || []).slice(0, 4).map((b) => (
                    <Text key={b} style={styles.note}>
                      - {b}
                    </Text>
                  ))}
                  <Text style={[styles.note, { marginTop: 8 }]}>Risques:</Text>
                  {(x.risks || []).slice(0, 4).map((r) => (
                    <Text key={r} style={styles.note}>
                      - {r}
                    </Text>
                  ))}
                </View>
              );
            })}
          </GlassCard>

          <GlassCard>
            <Text style={styles.cardTitle}>Patterns & notes</Text>
            <View style={{ height: Tokens.space.sm }} />
            {(result.patterns || []).map((x) => (
              <View key={x} style={styles.bulletRow}>
                <View style={[styles.dot, { backgroundColor: Colors.warning }]} />
                <Text style={styles.text}>{x}</Text>
              </View>
            ))}
            {(result.disclaimers || []).map((x) => (
              <View key={x} style={styles.bulletRow}>
                <View style={[styles.dot, { backgroundColor: Colors.faint }]} />
                <Text style={styles.text}>{x}</Text>
              </View>
            ))}
          </GlassCard>

          <GlassCard>
            <Text style={styles.cardTitle}>Prochain choix</Text>
            <Text style={styles.body}>{result.final_user_prompt}</Text>
            <View style={{ height: Tokens.space.md }} />
            <View style={styles.row2}>
              <PrimaryButton
                title="1) Roadmap re‑candidature"
                onPress={async () => {
                  const visaId = await upsertVisa(visaHint);
                  await addManualEvent({
                    visaId,
                    type: "other",
                    title: "Roadmap re‑candidature (refus)",
                    notes: roadmapText,
                    meta: { refusal_analysis: result },
                  });
                }}
                style={{ flex: 1 }}
              />
              <PrimaryButton title="2) Plan B: itinéraire + coûts" variant="ghost" onPress={() => router.push("/tools/travel")} style={{ flex: 1 }} />
            </View>
            <View style={{ height: Tokens.space.sm }} />
            <View style={styles.row2}>
              <PrimaryButton title="3) Rappels actions correctives" variant="ghost" onPress={() => setRemindersOpen(true)} style={{ flex: 1 }} />
              <PrimaryButton
                title="Sauver sélection Plan B"
                variant="ghost"
                onPress={async () => {
                  const chosen = Object.keys(followPlanB).filter((k) => followPlanB[k]);
                  if (!chosen.length) return;
                  const visaId = await upsertVisa(visaHint);
                  await addManualEvent({
                    visaId,
                    type: "other",
                    title: "Plan B (sélections)",
                    notes: chosen.map((x) => `- ${x}`).join("\n"),
                    meta: { plan_b: chosen },
                  });
                }}
                style={{ flex: 1, opacity: Object.keys(followPlanB).some((k) => followPlanB[k]) ? 1 : 0.6 }}
              />
            </View>
            <View style={{ height: Tokens.space.sm }} />
            <View style={styles.row2}>
              <PrimaryButton title="Ouvrir estimation coûts" variant="ghost" onPress={() => router.push("/tools/costs")} style={{ flex: 1 }} />
              <PrimaryButton title="Ouvrir timeline" variant="ghost" onPress={() => router.push("/(tabs)/appointments")} style={{ flex: 1 }} />
            </View>
          </GlassCard>
        </>
      ) : null}

      {remindersOpen && result ? (
        <View style={styles.overlay}>
          <GlassCard>
            <Text style={styles.cardTitle}>Rappels (actions correctives)</Text>
            <Text style={styles.body}>Choisissez une date de départ (YYYY-MM-DD). Les tâches seront étalées sur les jours suivants.</Text>
            <TextInput
              value={remindersStartIso}
              onChangeText={setRemindersStartIso}
              style={styles.input}
              placeholder="2026-01-15"
              placeholderTextColor="rgba(16,22,47,0.35)"
            />
            <View style={{ height: Tokens.space.md }} />
            <View style={styles.row2}>
              <PrimaryButton title="Annuler" variant="ghost" onPress={() => setRemindersOpen(false)} style={{ flex: 1 }} />
              <PrimaryButton
                title="Créer les rappels"
                onPress={async () => {
                  const base = remindersStartIso.trim() || todayIso();
                  const visaId = await upsertVisa(visaHint);
                  const steps = (result.B_corrective_steps || []).filter((s) => !resolved[s.related_reason]).slice(0, 6);
                  for (let i = 0; i < steps.length; i += 1) {
                    const s = steps[i];
                    await addManualEvent({
                      visaId,
                      type: "deadline",
                      title: `Action corrective: ${s.step}`,
                      dateIso: addDaysIso(base, i * 2),
                      notes: `Priorité: ${s.priority}\nMotif: ${s.related_reason}\nPreuve requise: ${s.verification_required ? "Oui" : "Non"}`,
                      meta: { refusal_analysis: result, corrective_step: s },
                    });
                  }
                  setRemindersOpen(false);
                  setRemindersStartIso("");
                }}
                style={{ flex: 1 }}
              />
            </View>
          </GlassCard>
        </View>
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
  label: { color: Colors.faint, fontSize: Tokens.font.size.sm, fontWeight: Tokens.font.weight.medium },
  row2: { flexDirection: "row", gap: 10, marginTop: 8 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  rowTitle: { flex: 1, color: Colors.text, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.bold, lineHeight: 22 },
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
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  loadingText: { color: Colors.muted, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.medium },
  error: { color: Colors.warning, fontSize: Tokens.font.size.md, lineHeight: 22 },
  bulletRow: { flexDirection: "row", gap: 10, marginTop: Tokens.space.sm, alignItems: "flex-start" },
  dot: { width: 10, height: 10, borderRadius: 99, marginTop: 6 },
  text: { flex: 1, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  note: { marginTop: 4, color: Colors.faint, fontSize: Tokens.font.size.sm, lineHeight: 20 },
  block: { marginTop: Tokens.space.md, padding: Tokens.space.md, borderRadius: Tokens.radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card2 },
  hint: { marginTop: Tokens.space.sm, color: Colors.faint, fontSize: Tokens.font.size.sm, lineHeight: 20 },
  overlay: { position: "absolute", left: 0, right: 0, bottom: 0, padding: Tokens.space.xl },
  notice: { marginTop: Tokens.space.md, padding: Tokens.space.md, borderRadius: Tokens.radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card2 },
  noticeText: { color: Colors.faint, fontSize: Tokens.font.size.sm, lineHeight: 20 },
});

