import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { Api, type VerifyUrlResponse } from "@/src/api/client";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";

export default function SecurityScreen() {
  const [url, setUrl] = useState("https://travel.state.gov/");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<VerifyUrlResponse | null>(null);

  useEffect(() => {
    // First run: prefill with a verdict only if API is up (optional).
    setVerdict(null);
  }, []);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Anti-scam & sécurité</Text>
        <Text style={styles.subtitle}>
          Vérifie un lien avant de l’ouvrir. Objectif: rester sur les portails officiels uniquement.
        </Text>
      </View>

      <GlassCard>
        <Text style={styles.cardTitle}>Vérifier une URL</Text>
        <View style={{ height: Tokens.space.sm }} />
        <TextInput
          value={url}
          onChangeText={setUrl}
          placeholder="https://..."
          placeholderTextColor="rgba(245,247,255,0.35)"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        <View style={{ height: Tokens.space.md }} />
        <PrimaryButton
          title={loading ? "Analyse…" : "Analyser"}
          onPress={async () => {
            setLoading(true);
            setError(null);
            try {
              const res = await Api.verifyUrl(url);
              setVerdict(res);
            } catch (e: any) {
              setError(String(e?.message || e));
            } finally {
              setLoading(false);
            }
          }}
          style={{ opacity: url.trim() ? 1 : 0.6 }}
        />
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Verdict</Text>
        <View style={{ height: Tokens.space.sm }} />
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Vérification…</Text>
          </View>
        ) : error ? (
          <Text style={styles.error}>
            {error}
            {"\n"}
            Astuce: démarrez l’API FastAPI et définissez `EXPO_PUBLIC_API_BASE_URL`.
          </Text>
        ) : verdict ? (
          <>
            <View style={styles.row}>
              <Text style={styles.k}>Domaine</Text>
              <Text style={styles.v}>{verdict.hostname || "—"}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.k}>HTTPS</Text>
              <Text style={styles.v}>{verdict.scheme === "https" ? "Oui" : "Non"}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.k}>Risque</Text>
              <Text style={styles.v}>
                {verdict.risk_level} ({Math.round(verdict.risk_score * 100)}%)
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.k}>Signal officiel</Text>
              <Text style={styles.v}>{verdict.likely_official ? "Plutôt oui" : "Inconnu / non"}</Text>
            </View>
          </>
        ) : (
          <Text style={styles.loadingText}>Lancez une analyse pour obtenir un verdict.</Text>
        )}
      </GlassCard>

      {verdict ? (
        <>
          <GlassCard>
            <Text style={styles.cardTitle}>Pourquoi</Text>
            <View style={{ height: Tokens.space.sm }} />
            {verdict.reasons.map((r) => (
              <View key={r} style={styles.bulletRow}>
                <View style={[styles.dot, { backgroundColor: Colors.warning }]} />
                <Text style={styles.text}>{r}</Text>
              </View>
            ))}
          </GlassCard>

          <GlassCard>
            <Text style={styles.cardTitle}>Étapes sûres</Text>
            <View style={{ height: Tokens.space.sm }} />
            {verdict.next_safe_steps.map((s) => (
              <View key={s} style={styles.bulletRow}>
                <View style={[styles.dot, { backgroundColor: Colors.brandB }]} />
                <Text style={styles.text}>{s}</Text>
              </View>
            ))}
            <View style={{ height: Tokens.space.md }} />
            <PrimaryButton
              title="Ouvrir dans l’app (WebView)"
              variant="ghost"
              onPress={() =>
                router.push({
                  pathname: "/portal",
                  params: { url, country: "", visa_type: "unknown", stage: "research", objective: "security_check" },
                })
              }
              style={{ opacity: url.trim() ? 1 : 0.6 }}
            />
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
  input: {
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
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  k: { color: Colors.faint, fontSize: Tokens.font.size.sm, width: 110 },
  v: { color: Colors.text, fontSize: Tokens.font.size.sm, fontWeight: Tokens.font.weight.semibold, flex: 1 },
  bulletRow: { flexDirection: "row", gap: 10, marginTop: Tokens.space.sm, alignItems: "flex-start" },
  dot: { width: 10, height: 10, borderRadius: 99, marginTop: 6 },
  text: { flex: 1, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
});

