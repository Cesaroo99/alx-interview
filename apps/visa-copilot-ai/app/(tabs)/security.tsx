import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { Mock } from "@/src/mock/data";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";

export default function SecurityScreen() {
  const [url, setUrl] = useState(Mock.security.input_url);

  // UI-only (mock): l’étape suivante sera l’appel API à `verify-url`.
  const verdict = { ...Mock.security, input_url: url };

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
        <PrimaryButton title="Analyser (démo)" onPress={() => undefined} />
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Verdict</Text>
        <View style={{ height: Tokens.space.sm }} />
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
      </GlassCard>

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
      </GlassCard>
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
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  k: { color: Colors.faint, fontSize: Tokens.font.size.sm, width: 110 },
  v: { color: Colors.text, fontSize: Tokens.font.size.sm, fontWeight: Tokens.font.weight.semibold, flex: 1 },
  bulletRow: { flexDirection: "row", gap: 10, marginTop: Tokens.space.sm, alignItems: "flex-start" },
  dot: { width: 10, height: 10, borderRadius: 99, marginTop: 6 },
  text: { flex: 1, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
});

