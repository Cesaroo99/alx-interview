import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { Mock } from "@/src/mock/data";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";

export default function ToolsScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Outils</Text>
        <Text style={styles.subtitle}>Modules de support (toujours au service de la crédibilité visa).</Text>
      </View>

      <GlassCard>
        <Text style={styles.cardTitle}>Propositions de visa</Text>
        <Text style={styles.body}>Voir les visas potentiellement accessibles + score et pistes d’amélioration.</Text>
        <View style={{ height: Tokens.space.md }} />
        <PrimaryButton title="Ouvrir" variant="ghost" onPress={() => router.push("/(tabs)/eligibility")} />
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Rendez-vous & rappels</Text>
        <Text style={styles.body}>Créer des rappels et suivre les délais.</Text>
        <View style={{ height: Tokens.space.md }} />
        <PrimaryButton title="Ouvrir" variant="ghost" onPress={() => router.push("/(tabs)/appointments")} />
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Abonnements & paiement</Text>
        <Text style={styles.body}>Choisir un plan et payer via checkout (MVP).</Text>
        <View style={{ height: Tokens.space.md }} />
        <PrimaryButton title="Voir les plans" variant="ghost" onPress={() => router.push("/(tabs)/billing")} />
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Travel Intelligence (simulation)</Text>
        <Text style={styles.body}>
          {Mock.trip.destination} · {Mock.trip.duration_days} jours · Budget {Mock.trip.estimated_budget_usd}$ ({Mock.trip.budget_level})
        </Text>
        <View style={{ height: Tokens.space.sm }} />
        {Mock.trip.itinerary_preview.map((x) => (
          <View key={x} style={styles.row}>
            <View style={[styles.dot, { backgroundColor: Colors.brandB }]} />
            <Text style={styles.text}>{x}</Text>
          </View>
        ))}
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Estimation coûts</Text>
        <Text style={styles.body}>
          Total estimé: {Mock.costs.total} {Mock.costs.currency} (d’après montants officiels fournis)
        </Text>
        <View style={{ height: Tokens.space.sm }} />
        {Mock.costs.items.slice(0, 3).map((i) => (
          <View key={i.label} style={styles.row}>
            <View style={[styles.dot, { backgroundColor: i.mandatory ? Colors.warning : Colors.faint }]} />
            <Text style={styles.text}>
              {i.label} — {i.amount} {Mock.costs.currency}
            </Text>
          </View>
        ))}
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Refus: explication + plan B</Text>
        <Text style={styles.body}>Quand il y a refus, on transforme ça en plan d’action clair et vérifiable.</Text>
        <View style={{ height: Tokens.space.sm }} />
        {Mock.refusal.plain_explanation.map((x) => (
          <View key={x} style={styles.row}>
            <View style={[styles.dot, { backgroundColor: Colors.danger }]} />
            <Text style={styles.text}>{x}</Text>
          </View>
        ))}
      </GlassCard>

      {process.env.EXPO_PUBLIC_ADMIN_MODE === "1" ? (
        <GlassCard>
          <Text style={styles.cardTitle}>Admin</Text>
          <Text style={styles.body}>Éditer les règles d’éligibilité (mode admin).</Text>
          <View style={{ height: Tokens.space.md }} />
          <PrimaryButton title="Règles éligibilité" variant="ghost" onPress={() => router.push("/(tabs)/admin_rules")} />
        </GlassCard>
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
  row: { flexDirection: "row", gap: 10, marginTop: Tokens.space.sm, alignItems: "flex-start" },
  dot: { width: 10, height: 10, borderRadius: 99, marginTop: 6 },
  text: { flex: 1, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
});

