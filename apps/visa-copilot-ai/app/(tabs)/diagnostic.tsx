import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Mock } from "@/src/mock/data";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { Screen } from "@/src/ui/Screen";
import { ScorePill } from "@/src/ui/ScorePill";

export default function DiagnosticScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Diagnostic visa</Text>
        <Text style={styles.subtitle}>Scores + explications. Objectif: augmenter la probabilité de succès avant dépôt.</Text>
      </View>

      <GlassCard>
        <Text style={styles.cardTitle}>Scores</Text>
        <View style={{ height: Tokens.space.md }} />
        <ScorePill label="Readiness" value={Mock.diagnostic.readiness_score} />
        <View style={{ height: Tokens.space.sm }} />
        <ScorePill label="Risque refus" value={Mock.diagnostic.refusal_risk_score} kind="risk" />
        <View style={{ height: Tokens.space.sm }} />
        <Text style={styles.meta}>Difficulté: {Mock.diagnostic.difficulty_level}</Text>
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Risques clés</Text>
        <View style={{ height: Tokens.space.sm }} />
        {Mock.diagnostic.key_risks.map((r) => (
          <View key={r} style={styles.row}>
            <View style={[styles.badge, { backgroundColor: "rgba(255,77,109,0.20)" }]} />
            <Text style={styles.text}>{r}</Text>
          </View>
        ))}
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Prochaines actions (visa-first)</Text>
        <View style={{ height: Tokens.space.sm }} />
        {Mock.diagnostic.next_best_actions.map((a) => (
          <View key={a} style={styles.row}>
            <View style={[styles.badge, { backgroundColor: "rgba(46,233,255,0.18)" }]} />
            <Text style={styles.text}>{a}</Text>
          </View>
        ))}
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Protection anti-scam</Text>
        <View style={{ height: Tokens.space.sm }} />
        {Mock.diagnostic.anti_scam_warnings.map((w) => (
          <View key={w} style={styles.row}>
            <View style={[styles.badge, { backgroundColor: "rgba(255,176,32,0.18)" }]} />
            <Text style={styles.text}>{w}</Text>
          </View>
        ))}
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 8 },
  title: {
    color: Colors.text,
    fontSize: Tokens.font.size.xxl,
    fontWeight: Tokens.font.weight.black,
  },
  subtitle: {
    color: Colors.muted,
    fontSize: Tokens.font.size.md,
    lineHeight: 22,
  },
  cardTitle: {
    color: Colors.text,
    fontSize: Tokens.font.size.lg,
    fontWeight: Tokens.font.weight.bold,
  },
  meta: {
    color: Colors.faint,
    fontSize: Tokens.font.size.sm,
    fontWeight: Tokens.font.weight.medium,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    marginTop: Tokens.space.sm,
    alignItems: "flex-start",
  },
  badge: {
    width: 10,
    height: 10,
    borderRadius: 99,
    marginTop: 6,
  },
  text: {
    flex: 1,
    color: Colors.muted,
    fontSize: Tokens.font.size.md,
    lineHeight: 22,
  },
});

