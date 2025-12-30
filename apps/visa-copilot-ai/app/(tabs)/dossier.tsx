import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { Api, type VerifyDossierResponse } from "@/src/api/client";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { HeroBanner } from "@/src/ui/HeroBanner";
import { ActionButton } from "@/src/ui/ActionButton";
import { Screen } from "@/src/ui/Screen";
import { ScorePill } from "@/src/ui/ScorePill";
import { useDocuments } from "@/src/state/documents";
import { useProfile } from "@/src/state/profile";

const DOC_TYPE_LABEL: Record<string, string> = {
  passport: "Passeport",
  photo: "Photo",
  bank_statement: "Relevé bancaire",
  payslips: "Fiches de paie",
  employment_letter: "Attestation employeur",
  business_registration: "Registre commerce / entreprise",
  student_certificate: "Certificat de scolarité",
  enrollment_letter: "Lettre d’inscription / acceptation",
  invitation_letter: "Lettre d’invitation",
  travel_insurance: "Assurance voyage",
  accommodation_plan: "Hébergement",
  itinerary: "Itinéraire",
  civil_status: "État civil",
  sponsor_letter: "Lettre sponsor",
  other: "Autre",
};

export default function DossierScreen() {
  const { profile } = useProfile();
  const { docs } = useDocuments();
  const [destination, setDestination] = useState(profile?.destination_region_hint || "Zone Schengen");
  const [visaType, setVisaType] = useState("Visa visiteur / tourisme");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyDossierResponse | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const payloadDocs = useMemo(
    () =>
      docs.map((d) => ({
        doc_id: d.id,
        doc_type: d.doc_type,
        filename: d.filename,
        extracted: d.extracted || {},
      })),
    [docs]
  );

  const docById = useMemo(() => {
    const m = new Map<string, (typeof docs)[number]>();
    for (const d of docs) m.set(d.id, d);
    return m;
  }, [docs]);

  const run = useCallback(async () => {
    if (!profile) {
      setError("Profil manquant: complétez l’onboarding.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await Api.verifyDossier({
        profile,
        visa_type: visaType,
        destination_region: destination,
        documents: payloadDocs,
      });
      setResult(res);
      setExpanded({}); // reset accordéons
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [profile, visaType, destination, payloadDocs]);

  const issues = result?.document_check?.issues || [];
  const missingTypes = result?.document_check?.missing_document_types || [];

  return (
    <Screen>
      <HeroBanner
        kicker="Vérification"
        title="Dossier"
        subtitle="Analyse avant dépôt: cohérence, risques clés, actions prioritaires — avec preuves (champs extraits)."
      />

      <GlassCard>
        <Text style={styles.cardTitle}>Paramètres</Text>
        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>Destination / zone</Text>
        <TextInput
          value={destination}
          onChangeText={setDestination}
          placeholder="Ex: Zone Schengen"
          placeholderTextColor="rgba(245,247,255,0.35)"
          style={styles.input}
        />
        <View style={{ height: Tokens.space.sm }} />
        <Text style={styles.label}>Type de visa</Text>
        <TextInput
          value={visaType}
          onChangeText={setVisaType}
          placeholder="Ex: Visa visiteur / tourisme"
          placeholderTextColor="rgba(245,247,255,0.35)"
          style={styles.input}
        />
        <View style={{ height: Tokens.space.lg }} />
        <ActionButton
          title={loading ? "Analyse…" : "Analyser le dossier"}
          onPress={run}
          style={{ opacity: profile ? 1 : 0.6 }}
          track={{ type: "dossier", label: "analyze", screen: "dossier", meta: { destination, visaType } }}
        />
        <View style={{ height: Tokens.space.sm }} />
        <ActionButton
          title="Ajouter un document"
          variant="ghost"
          onPress={() => router.push("/documents/add")}
          track={{ type: "nav", label: "add_document", screen: "dossier" }}
        />

        <View style={{ height: Tokens.space.md }} />
        <View style={styles.rowButtons}>
          <ActionButton title="Itinéraire" variant="ghost" onPress={() => router.push("/tools/travel")} style={{ flex: 1 }} track={{ type: "nav", label: "open_travel_tool", screen: "dossier" }} />
          <ActionButton title="Coûts" variant="ghost" onPress={() => router.push("/tools/costs")} style={{ flex: 1 }} track={{ type: "nav", label: "open_costs_tool", screen: "dossier" }} />
          <ActionButton title="Refus / Plan B" variant="ghost" onPress={() => router.push("/tools/refusal")} style={{ flex: 1 }} track={{ type: "nav", label: "open_refusal_tool", screen: "dossier" }} />
        </View>
      </GlassCard>

      {loading ? (
        <GlassCard>
          <View style={styles.loadingRow}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Vérification du dossier…</Text>
          </View>
        </GlassCard>
      ) : error ? (
        <GlassCard>
          <Text style={styles.error}>{error}</Text>
          <Text style={styles.body}>
            Astuce: démarrez l’API FastAPI et configurez `EXPO_PUBLIC_API_BASE_URL`.
          </Text>
        </GlassCard>
      ) : result ? (
        <>
          <GlassCard>
            <Text style={styles.cardTitle}>Score dossier</Text>
            <View style={{ height: Tokens.space.md }} />
            <ScorePill label="Readiness dossier" value={Number(result.readiness_score || 0)} />
            <View style={{ height: Tokens.space.sm }} />
            <View style={styles.row}>
              <Text style={styles.k}>Cohérence</Text>
              <Text style={styles.v}>{Math.round(Number(result.coherence_score || 0))}/100</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.k}>Niveau</Text>
              <Text style={styles.v}>{String(result.readiness_level || "—")}</Text>
            </View>
            <View style={{ height: Tokens.space.md }} />
            <ActionButton
              title="Vérifier à nouveau"
              variant="ghost"
              onPress={run}
              track={{ type: "dossier", label: "reanalyze", screen: "dossier", meta: { destination, visaType } }}
            />
          </GlassCard>

          {missingTypes.length ? (
            <GlassCard>
              <Text style={styles.cardTitle}>Documents manquants (template)</Text>
              <Text style={styles.body}>
                Ce sont des manquants “génériques”. Pour être exact, il faut la checklist officielle de votre pays/visa.
              </Text>
              <View style={{ height: Tokens.space.md }} />
              {missingTypes.slice(0, 12).map((t) => (
                <View key={t} style={styles.missingRow}>
                  <Text style={styles.text}>{DOC_TYPE_LABEL[t] || t}</Text>
                  <ActionButton
                    title="Ajouter"
                    variant="ghost"
                    onPress={() => router.push({ pathname: "/documents/add", params: { doc_type: t } })}
                    track={{ type: "docs", label: "add_missing_doc", screen: "dossier", target: t }}
                  />
                </View>
              ))}
            </GlassCard>
          ) : null}

          {issues.length ? (
            <GlassCard>
              <Text style={styles.cardTitle}>Contrôles (interactifs)</Text>
              <Text style={styles.body}>
                Chaque point ci-dessous affiche les “preuves” utilisées (champs extraits). Cliquez pour voir détails et agir.
              </Text>
              <View style={{ height: Tokens.space.md }} />

              {issues.slice(0, 20).map((it) => {
                const open = !!expanded[it.code];
                const tone = it.severity === "risk" ? Colors.danger : it.severity === "warning" ? Colors.warning : Colors.faint;
                const ev = Array.isArray(it.evidence) ? it.evidence : [];
                const firstDocId = ev.find((e) => e?.doc_id)?.doc_id || null;
                const firstKey = ev.find((e) => e?.extracted_key)?.extracted_key || null;
                const doc = firstDocId ? docById.get(String(firstDocId)) : undefined;

                return (
                  <View key={it.code} style={{ marginTop: Tokens.space.md }}>
                    <View style={styles.issueHeader}>
                      <View style={[styles.dot, { backgroundColor: tone }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.issueTitle}>{it.message}</Text>
                        <Text style={styles.issueMeta}>{it.code}</Text>
                      </View>
                      <ActionButton
                        title={open ? "Réduire" : "Détails"}
                        variant="ghost"
                        onPress={() => setExpanded((p) => ({ ...p, [it.code]: !open }))}
                        track={{ type: "ui", label: open ? "collapse_issue" : "expand_issue", screen: "dossier", target: it.code }}
                      />
                    </View>

                    {open ? (
                      <View style={styles.issueBody}>
                        {(it.why || []).slice(0, 4).map((w) => (
                          <Text key={w} style={styles.body}>
                            • {w}
                          </Text>
                        ))}

                        {(it.suggested_fix || []).length ? (
                          <View style={{ marginTop: Tokens.space.sm }}>
                            <Text style={styles.issueSection}>Actions proposées</Text>
                            {(it.suggested_fix || []).slice(0, 4).map((s) => (
                              <Text key={s} style={styles.body}>
                                ✅ {s}
                              </Text>
                            ))}
                          </View>
                        ) : null}

                        {ev.length ? (
                          <View style={{ marginTop: Tokens.space.sm }}>
                            <Text style={styles.issueSection}>Preuves (champs extraits)</Text>
                            {ev.slice(0, 6).map((e, idx) => {
                              const local = e?.doc_id ? docById.get(String(e.doc_id)) : undefined;
                              const label = local ? `${local.doc_type} · ${local.filename}` : e?.doc_type || "document";
                              const k = e?.extracted_key ? String(e.extracted_key) : "—";
                              const v = e?.present ? String(e?.value ?? "") : "(manquant)";
                              return (
                                <View key={`${it.code}_${idx}`} style={styles.evRow}>
                                  <Text style={styles.evText}>
                                    {label} — {k} = {v}
                                  </Text>
                                  {e?.note ? <Text style={styles.evNote}>{String(e.note)}</Text> : null}
                                  {e?.doc_id ? (
                                    <View style={styles.evActions}>
                                      <ActionButton
                                        title="Ouvrir"
                                        variant="ghost"
                                        onPress={() => router.push({ pathname: "/documents/edit", params: { id: String(e.doc_id), focus: e.extracted_key || undefined } })}
                                        track={{ type: "nav", label: "open_doc_from_issue", screen: "dossier", target: String(e.doc_id) }}
                                      />
                                      {!e.present && e.extracted_key ? (
                                        <ActionButton
                                          title="Compléter"
                                          variant="ghost"
                                          onPress={() => router.push({ pathname: "/documents/edit", params: { id: String(e.doc_id), focus: String(e.extracted_key) } })}
                                          track={{ type: "docs", label: "complete_extracted_field", screen: "dossier", target: String(e.extracted_key) }}
                                        />
                                      ) : null}
                                    </View>
                                  ) : null}
                                </View>
                              );
                            })}
                          </View>
                        ) : null}

                        {!doc && (it.code === "NO_PASSPORT" || it.code === "MISSING_REQUIRED_DOCS") ? (
                          <View style={{ marginTop: Tokens.space.sm }}>
                            <ActionButton
                              title="Ajouter un document"
                              variant="ghost"
                              onPress={() => router.push("/documents/add")}
                              track={{ type: "docs", label: "add_doc_from_issue", screen: "dossier", target: it.code }}
                            />
                          </View>
                        ) : null}

                        {firstDocId ? (
                          <View style={{ marginTop: Tokens.space.sm }}>
                            <ActionButton
                              title="Ouvrir le document lié"
                              variant="ghost"
                              onPress={() => router.push({ pathname: "/documents/edit", params: { id: String(firstDocId), focus: firstKey || undefined } })}
                              track={{ type: "nav", label: "open_linked_doc", screen: "dossier", target: String(firstDocId) }}
                            />
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </GlassCard>
          ) : null}

          <GlassCard>
            <Text style={styles.cardTitle}>Risques clés</Text>
            <View style={{ height: Tokens.space.sm }} />
            {(result.key_risks || []).slice(0, 8).map((r: string) => (
              <View key={r} style={styles.bulletRow}>
                <View style={[styles.dot, { backgroundColor: Colors.danger }]} />
                <Text style={styles.text}>{r}</Text>
              </View>
            ))}
          </GlassCard>

          <GlassCard>
            <Text style={styles.cardTitle}>Actions recommandées</Text>
            <View style={{ height: Tokens.space.sm }} />
            {(result.next_best_actions || []).slice(0, 10).map((a: string) => (
              <View key={a} style={styles.bulletRow}>
                <View style={[styles.dot, { backgroundColor: Colors.brandB }]} />
                <Text style={styles.text}>{a}</Text>
              </View>
            ))}
            <View style={{ height: Tokens.space.md }} />
            <ActionButton
              title="Ajouter des documents puis re-vérifier"
              variant="ghost"
              onPress={() => router.push("/documents/add")}
              track={{ type: "docs", label: "add_docs_then_rerun", screen: "dossier" }}
            />
          </GlassCard>
        </>
      ) : null}

    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { color: Colors.text, fontSize: Tokens.font.size.lg, fontWeight: Tokens.font.weight.bold },
  label: { color: Colors.faint, fontSize: Tokens.font.size.sm, fontWeight: Tokens.font.weight.medium },
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
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  loadingText: { color: Colors.muted, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.medium },
  error: { color: Colors.warning, fontSize: Tokens.font.size.md, lineHeight: 22 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  rowButtons: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  k: { color: Colors.faint, fontSize: Tokens.font.size.sm, width: 120 },
  v: { color: Colors.text, fontSize: Tokens.font.size.sm, fontWeight: Tokens.font.weight.semibold, flex: 1 },
  bulletRow: { flexDirection: "row", gap: 10, marginTop: Tokens.space.sm, alignItems: "flex-start" },
  dot: { width: 10, height: 10, borderRadius: 99, marginTop: 6 },
  text: { flex: 1, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  missingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: Tokens.space.sm },
  issueHeader: { flexDirection: "row", gap: 10, alignItems: "center" },
  issueTitle: { color: Colors.text, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.bold },
  issueMeta: { marginTop: 2, color: Colors.faint, fontSize: Tokens.font.size.sm },
  issueBody: { marginTop: Tokens.space.sm, paddingLeft: 20 },
  issueSection: { color: Colors.faint, fontSize: Tokens.font.size.sm, fontWeight: Tokens.font.weight.semibold, marginTop: Tokens.space.sm },
  evRow: { marginTop: Tokens.space.sm },
  evText: { color: Colors.muted, fontSize: Tokens.font.size.sm, lineHeight: 20 },
  evNote: { marginTop: 2, color: Colors.faint, fontSize: Tokens.font.size.sm, lineHeight: 20 },
  evActions: { flexDirection: "row", gap: 10, marginTop: 6, flexWrap: "wrap" },
});

