import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Mock } from "@/src/mock/data";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";
import { ScorePill } from "@/src/ui/ScorePill";

export default function DossierScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Dossier</Text>
        <Text style={styles.subtitle}>Vérification avant dépôt: cohérence, pièces manquantes, score de readiness.</Text>
      </View>

      <GlassCard>
        <Text style={styles.cardTitle}>Score dossier (démo)</Text>
        <View style={{ height: Tokens.space.md }} />
        <ScorePill label="Readiness dossier" value={Mock.dossier.readiness_score} />
        <View style={{ height: Tokens.space.sm }} />
        <View style={styles.row}>
          <Text style={styles.k}>Cohérence</Text>
          <Text style={styles.v}>{Math.round(Mock.dossier.coherence_score)}/100</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.k}>Niveau</Text>
          <Text style={styles.v}>{Mock.dossier.readiness_level}</Text>
        </View>
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Risques clés</Text>
        <View style={{ height: Tokens.space.sm }} />
        {Mock.dossier.key_risks.map((r) => (
          <View key={r} style={styles.bulletRow}>
            <View style={[styles.dot, { backgroundColor: Colors.danger }]} />
            <Text style={styles.text}>{r}</Text>
          </View>
        ))}
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Actions recommandées</Text>
        <View style={{ height: Tokens.space.sm }} />
        {Mock.dossier.next_best_actions.map((a) => (
          <View key={a} style={styles.bulletRow}>
            <View style={[styles.dot, { backgroundColor: Colors.brandB }]} />
            <Text style={styles.text}>{a}</Text>
          </View>
        ))}
        <View style={{ height: Tokens.space.lg }} />
        <PrimaryButton title="Importer des documents (à venir)" onPress={() => undefined} />
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 8 },
  title: { color: Colors.text, fontSize: Tokens.font.size.xxl, fontWeight: Tokens.font.weight.black },
  subtitle: { color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  cardTitle: { color: Colors.text, fontSize: Tokens.font.size.lg, fontWeight: Tokens.font.weight.bold },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  k: { color: Colors.faint, fontSize: Tokens.font.size.sm, width: 120 },
  v: { color: Colors.text, fontSize: Tokens.font.size.sm, fontWeight: Tokens.font.weight.semibold, flex: 1 },
  bulletRow: { flexDirection: "row", gap: 10, marginTop: Tokens.space.sm, alignItems: "flex-start" },
  dot: { width: 10, height: 10, borderRadius: 99, marginTop: 6 },
  text: { flex: 1, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
});

