import React, { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";

import { Api, type RefusalResponse } from "@/src/api/client";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";

const REASONS: Array<{ code: string; label: string }> = [
  { code: "insufficient_funds", label: "Fonds insuffisants" },
  { code: "ties_not_sufficient", label: "Attaches insuffisantes" },
  { code: "purpose_not_clear", label: "Motif pas clair" },
  { code: "documents_not_reliable", label: "Docs non fiables" },
  { code: "overstay_risk", label: "Risque dépassement" },
];

export default function RefusalCoachScreen() {
  const [selected, setSelected] = useState<string[]>(["insufficient_funds", "ties_not_sufficient"]);
  const [letter, setLetter] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RefusalResponse | null>(null);

  const canRun = useMemo(() => selected.length > 0 || letter.trim().length > 10, [selected.length, letter]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Refus: explication + plan B</Text>
        <Text style={styles.subtitle}>On transforme un refus en plan d’actions vérifiables (sans promesse irréaliste).</Text>
      </View>

      <GlassCard>
        <Text style={styles.cardTitle}>Motifs (codes)</Text>
        <Text style={styles.body}>Sélectionne ce qui ressemble au courrier. Tu peux aussi coller le texte (optionnel).</Text>
        <View style={{ height: Tokens.space.md }} />

        <View style={styles.grid}>
          {REASONS.map((r) => {
            const on = selected.includes(r.code);
            return (
              <PrimaryButton
                key={r.code}
                title={r.label}
                variant={on ? "brand" : "ghost"}
                onPress={() => {
                  setSelected((prev) => (prev.includes(r.code) ? prev.filter((x) => x !== r.code) : [...prev, r.code]));
                }}
                style={{ flexBasis: "48%" }}
              />
            );
          })}
        </View>

        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>Texte du refus (optionnel)</Text>
        <TextInput
          value={letter}
          onChangeText={setLetter}
          placeholder="Colle ici un extrait du courrier (sans données sensibles si possible)…"
          placeholderTextColor="rgba(245,247,255,0.35)"
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
              const res = await Api.explainRefusal({
                refusal_reasons: selected,
                refusal_letter_text: letter.trim() ? letter.trim() : null,
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
            <Text style={styles.cardTitle}>Explication simple</Text>
            <View style={{ height: Tokens.space.sm }} />
            {result.plain_explanation.map((x) => (
              <View key={x} style={styles.bulletRow}>
                <View style={[styles.dot, { backgroundColor: Colors.danger }]} />
                <Text style={styles.text}>{x}</Text>
              </View>
            ))}
          </GlassCard>

          <GlassCard>
            <Text style={styles.cardTitle}>Causes probables</Text>
            <View style={{ height: Tokens.space.sm }} />
            {result.likely_root_causes.map((x) => (
              <View key={x} style={styles.bulletRow}>
                <View style={[styles.dot, { backgroundColor: Colors.warning }]} />
                <Text style={styles.text}>{x}</Text>
              </View>
            ))}
          </GlassCard>

          <GlassCard>
            <Text style={styles.cardTitle}>Actions correctives</Text>
            <View style={{ height: Tokens.space.sm }} />
            {result.corrective_actions.map((x) => (
              <View key={x} style={styles.bulletRow}>
                <View style={[styles.dot, { backgroundColor: Colors.brandB }]} />
                <Text style={styles.text}>{x}</Text>
              </View>
            ))}
          </GlassCard>

          <GlassCard>
            <Text style={styles.cardTitle}>Plan B</Text>
            <View style={{ height: Tokens.space.sm }} />
            {result.plan_b_options.map((x) => (
              <View key={x} style={styles.bulletRow}>
                <View style={[styles.dot, { backgroundColor: Colors.faint }]} />
                <Text style={styles.text}>{x}</Text>
              </View>
            ))}
          </GlassCard>

          <GlassCard>
            <Text style={styles.cardTitle}>Anti‑scam</Text>
            <View style={{ height: Tokens.space.sm }} />
            {result.anti_scam_warnings.map((x) => (
              <View key={x} style={styles.bulletRow}>
                <View style={[styles.dot, { backgroundColor: Colors.warning }]} />
                <Text style={styles.text}>{x}</Text>
              </View>
            ))}
          </GlassCard>

          <GlassCard>
            <Text style={styles.cardTitle}>Notes</Text>
            <View style={{ height: Tokens.space.sm }} />
            {result.disclaimers.map((x) => (
              <View key={x} style={styles.bulletRow}>
                <View style={[styles.dot, { backgroundColor: Colors.faint }]} />
                <Text style={styles.text}>{x}</Text>
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
  body: { marginTop: Tokens.space.sm, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  label: { color: Colors.faint, fontSize: Tokens.font.size.sm, fontWeight: Tokens.font.weight.medium },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
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
});

