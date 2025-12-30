import React, { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { Api } from "@/src/api/client";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";
import { ScorePill } from "@/src/ui/ScorePill";
import { useDocuments } from "@/src/state/documents";
import { useProfile } from "@/src/state/profile";

export default function DossierScreen() {
  const { profile } = useProfile();
  const { docs } = useDocuments();
  const [destination, setDestination] = useState(profile?.destination_region_hint || "Zone Schengen");
  const [visaType, setVisaType] = useState("Visa visiteur / tourisme");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

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

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Dossier</Text>
        <Text style={styles.subtitle}>Vérification avant dépôt: cohérence, pièces manquantes, score de readiness.</Text>
      </View>

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
          onPress={async () => {
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
          }}
          style={{ opacity: profile ? 1 : 0.6 }}
        />

        <View style={{ height: Tokens.space.md }} />
        <View style={styles.rowButtons}>
          <PrimaryButton title="Itinéraire" variant="ghost" onPress={() => router.push("/tools/travel")} style={{ flex: 1 }} />
          <PrimaryButton title="Coûts" variant="ghost" onPress={() => router.push("/tools/costs")} style={{ flex: 1 }} />
          <PrimaryButton title="Refus / Plan B" variant="ghost" onPress={() => router.push("/tools/refusal")} style={{ flex: 1 }} />
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
});

