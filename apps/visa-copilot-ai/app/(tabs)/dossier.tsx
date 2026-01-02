import React, { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { Api } from "@/src/api/client";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { HeroBanner } from "@/src/ui/HeroBanner";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";
import { ScorePill } from "@/src/ui/ScorePill";
import { useDocuments } from "@/src/state/documents";
import { useProfile } from "@/src/state/profile";
import { useVisaTimeline } from "@/src/state/visa_timeline";

export default function DossierScreen() {
  const { profile } = useProfile();
  const { docs } = useDocuments();
  const { state: timelineState } = useVisaTimeline();
  const [destination, setDestination] = useState(profile?.destination_region_hint || "Zone Schengen");
  const [visaType, setVisaType] = useState("Visa visiteur / tourisme");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
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

  async function run() {
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
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  const activeVisaId = useMemo(() => {
    const visas = timelineState.visas || [];
    if (!visas.length) return null;
    return visas.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0]?.id || null;
  }, [timelineState.visas]);

  function goToBlockingIssue() {
    const missing = (result?.document_check?.missing_document_types || []) as string[];
    if (missing.length) {
      router.push({ pathname: "/documents/add", params: { doc_type: String(missing[0]) } });
      return;
    }
    const issues = (result?.document_check?.issues || []) as any[];
    const top = issues.find((x) => String(x?.severity || "").toLowerCase() === "risk") || issues[0];
    const code = String(top?.code || "").toUpperCase();
    if (code.includes("TRIP") || code.includes("ITIN") || code.includes("INSURANCE")) {
      router.push("/tools/travel");
      return;
    }
    if (code.includes("BANK") || code.includes("FUNDS")) {
      router.push("/(tabs)/documents");
      return;
    }
    if (activeVisaId) {
      router.push(`/visa/${activeVisaId}` as any);
      return;
    }
    router.push("/(tabs)/parcours");
  }

  return (
    <Screen>
      <HeroBanner
        kicker="Vérification"
        title="Dossier"
        subtitle="Analyse avant dépôt: cohérence, risques clés, actions prioritaires."
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
        <PrimaryButton
          title={loading ? "Analyse…" : "Analyser le dossier"}
          onPress={run}
          style={{ opacity: profile ? 1 : 0.6 }}
        />

        <View style={{ height: Tokens.space.md }} />
        <View style={styles.rowButtons}>
          <PrimaryButton title="Itinéraire" variant="ghost" onPress={() => router.push("/tools/travel")} style={{ flex: 1 }} />
          <PrimaryButton title="Coûts" variant="ghost" onPress={() => router.push("/tools/costs")} style={{ flex: 1 }} />
          {/* Module refus volontairement discret: pas d'accès depuis la navigation générale */}
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
            <Text style={styles.cardTitle}>Résumé (read-only)</Text>
            <Text style={styles.body}>Ce tableau sert à prioriser ce qui bloque la soumission. Corrigez, puis relancez.</Text>
            <View style={{ height: Tokens.space.md }} />
            <View style={styles.row}>
              <Text style={styles.k}>Checks</Text>
              <Text style={styles.v}>{Array.isArray(result?.document_check?.issues) ? result.document_check.issues.length : 0}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.k}>High risks</Text>
              <Text style={styles.v}>
                {Array.isArray(result?.document_check?.issues) ? result.document_check.issues.filter((x: any) => String(x?.severity || "").toLowerCase() === "risk").length : 0}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.k}>Medium risks</Text>
              <Text style={styles.v}>
                {Array.isArray(result?.document_check?.issues) ? result.document_check.issues.filter((x: any) => String(x?.severity || "").toLowerCase() === "warning").length : 0}
              </Text>
            </View>
            <View style={{ height: Tokens.space.md }} />
            <View style={styles.rowButtons}>
              <PrimaryButton title="Go to blocking issue" onPress={goToBlockingIssue} style={{ flex: 1 }} />
              <PrimaryButton title="Run verification again" variant="ghost" onPress={run} style={{ flex: 1 }} />
            </View>
          </GlassCard>

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
          </GlassCard>

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
          </GlassCard>

          <GlassCard>
            <Text style={styles.cardTitle}>Contrôles (interactifs)</Text>
            <Text style={styles.body}>
              Chaque point inclut les champs extraits utilisés. Vous pouvez ouvrir un document ou compléter un champ puis relancer la vérification.
            </Text>
            <View style={{ height: Tokens.space.md }} />
            {Array.isArray(result?.document_check?.issues) && result.document_check.issues.length ? (
              result.document_check.issues.map((it: any) => {
                const code = String(it?.code || it?.message || "issue");
                const isOpen = !!expanded[code];
                return (
                  <View key={code} style={styles.issueBlock}>
                    <View style={styles.issueHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.issueTitle}>
                          {String(it?.severity || "info").toUpperCase()} · {String(it?.message || "—")}
                        </Text>
                        {Array.isArray(it?.suggested_fix) && it.suggested_fix[0] ? (
                          <Text style={styles.issueSub}>{String(it.suggested_fix[0])}</Text>
                        ) : null}
                      </View>
                      <PrimaryButton
                        title={isOpen ? "Masquer" : "Détails"}
                        variant="ghost"
                        onPress={() => setExpanded((s) => ({ ...s, [code]: !s[code] }))}
                      />
                    </View>

                    {isOpen ? (
                      <View style={{ marginTop: Tokens.space.sm, gap: Tokens.space.sm }}>
                        {(it?.evidence || []).length ? (
                          (it.evidence || []).map((ev: any, idx: number) => {
                            const docId = String(ev?.doc_id || "");
                            const docType = String(ev?.doc_type || "");
                            const key = String(ev?.extracted_key || "");
                            const present = !!ev?.present;
                            const note = String(ev?.note || "");
                            const value = ev?.value;

                            return (
                              <View key={`${code}_${idx}`} style={styles.evRow}>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.evTitle}>
                                    {docType || "document"} · {key || "champ"} · {present ? "présent" : "manquant"}
                                  </Text>
                                  <Text style={styles.evBody}>
                                    Valeur: {value === null || value === undefined || value === "" ? "—" : String(value)}
                                    {note ? ` · ${note}` : ""}
                                  </Text>
                                </View>
                                <View style={styles.evActions}>
                                  {docId ? (
                                    <>
                                      <PrimaryButton
                                        title="Ouvrir"
                                        variant="ghost"
                                        onPress={() => router.push({ pathname: "/documents/edit", params: { id: docId } })}
                                      />
                                      {!present && key ? (
                                        <PrimaryButton
                                          title="Compléter"
                                          variant="ghost"
                                          onPress={() => router.push({ pathname: "/documents/edit", params: { id: docId, focus: key } })}
                                        />
                                      ) : null}
                                    </>
                                  ) : docType ? (
                                    <PrimaryButton
                                      title="Ajouter"
                                      variant="ghost"
                                      onPress={() => router.push({ pathname: "/documents/add", params: { doc_type: docType } })}
                                    />
                                  ) : null}
                                </View>
                              </View>
                            );
                          })
                        ) : (
                          <Text style={styles.body}>Aucune preuve fournie pour ce point.</Text>
                        )}
                      </View>
                    ) : null}
                  </View>
                );
              })
            ) : (
              <Text style={styles.body}>Aucun contrôle détaillé.</Text>
            )}

            <View style={{ height: Tokens.space.md }} />
            <View style={styles.rowButtons}>
              <PrimaryButton title="Ajouter un document" variant="ghost" onPress={() => router.push("/documents/add")} style={{ flex: 1 }} />
              <PrimaryButton title="Vérifier à nouveau" onPress={run} style={{ flex: 1 }} />
            </View>
          </GlassCard>

          <GlassCard>
            <Text style={styles.cardTitle}>Documents manquants (template)</Text>
            <Text style={styles.body}>Liste générique: à confirmer sur la checklist officielle (pays/visa/nationalité).</Text>
            <View style={{ height: Tokens.space.sm }} />
            {Array.isArray(result?.document_check?.missing_document_types) && result.document_check.missing_document_types.length ? (
              (result.document_check.missing_document_types || []).map((t: string) => (
                <View key={t} style={styles.missingRow}>
                  <Text style={styles.missingText}>{t}</Text>
                  <PrimaryButton title="Ajouter" variant="ghost" onPress={() => router.push({ pathname: "/documents/add", params: { doc_type: t } })} />
                </View>
              ))
            ) : (
              <Text style={styles.body}>Aucune pièce manquante détectée (selon le template).</Text>
            )}
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
  issueBlock: { marginTop: Tokens.space.sm, paddingTop: Tokens.space.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  issueHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  issueTitle: { color: Colors.text, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.bold, lineHeight: 22 },
  issueSub: { marginTop: 4, color: Colors.faint, fontSize: Tokens.font.size.sm, lineHeight: 20 },
  evRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  evTitle: { color: Colors.text, fontSize: Tokens.font.size.sm, fontWeight: Tokens.font.weight.semibold },
  evBody: { marginTop: 4, color: Colors.muted, fontSize: Tokens.font.size.sm, lineHeight: 20 },
  evActions: { alignItems: "flex-end", gap: 6 },
  missingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: Tokens.space.sm },
  missingText: { color: Colors.muted, fontSize: Tokens.font.size.md, flex: 1 },
});

