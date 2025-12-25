import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";

export default function DocumentsScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Documents</Text>
        <Text style={styles.subtitle}>
          Upload + vérification automatique (OCR/IA). MVP: structure + checklist; OCR sera branché ensuite.
        </Text>
      </View>

      <GlassCard>
        <Text style={styles.cardTitle}>Votre coffre</Text>
        <Text style={styles.body}>Ajoutez vos documents (passeport, relevés, attestations). On vous dira quoi corriger.</Text>
        <View style={{ height: Tokens.space.lg }} />
        <PrimaryButton title="Ajouter un document (à brancher)" onPress={() => undefined} />
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Badges</Text>
        <View style={{ height: Tokens.space.sm }} />
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: "rgba(39,226,164,0.12)", borderColor: "rgba(39,226,164,0.35)" }]}>
            <Text style={styles.badgeText}>Valide</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: "rgba(255,176,32,0.12)", borderColor: "rgba(255,176,32,0.35)" }]}>
            <Text style={styles.badgeText}>À corriger</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: "rgba(255,77,109,0.12)", borderColor: "rgba(255,77,109,0.35)" }]}>
            <Text style={styles.badgeText}>Critique</Text>
          </View>
        </View>
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 8 },
  title: { color: Colors.text, fontSize: Tokens.font.size.xxl, fontWeight: Tokens.font.weight.black },
  subtitle: { color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  cardTitle: { color: Colors.text, fontSize: Tokens.font.size.lg, fontWeight: Tokens.font.weight.bold },
  body: { marginTop: Tokens.space.sm, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  badgeRow: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: Tokens.space.sm },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  badgeText: { color: Colors.text, fontSize: Tokens.font.size.sm, fontWeight: Tokens.font.weight.semibold },
});

