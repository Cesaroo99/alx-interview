import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { HeroBanner } from "@/src/ui/HeroBanner";
import { ActionButton } from "@/src/ui/ActionButton";
import { Screen } from "@/src/ui/Screen";

export default function ToolsScreen() {
  return (
    <Screen>
      <HeroBanner
        kicker="Boîte à outils"
        title="Outils"
        subtitle="Plan, coûts, refus, sécurité… tout ce qu’il faut pour rendre ton dossier cohérent."
      />

      <GlassCard>
        <Text style={styles.cardTitle}>Formulaires & démarches</Text>
        <Text style={styles.body}>
          Parcours guidé pour formulaires d’ambassades, écoles et services administratifs (sans auto‑soumission).
        </Text>
        <View style={{ height: Tokens.space.md }} />
        <ActionButton title="Ouvrir" variant="ghost" onPress={() => router.push("/forms")} track={{ type: "nav", label: "open_forms", screen: "tools" }} />
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Préparer le dossier (priorité)</Text>
        <Text style={styles.body}>Les 3 actions qui améliorent le plus vite la cohérence: itinéraire, budget, corrections.</Text>
        <View style={{ height: Tokens.space.md }} />
        <View style={styles.rowButtons}>
          <ActionButton title="Itinéraire" variant="ghost" onPress={() => router.push("/tools/travel")} style={{ flex: 1 }} track={{ type: "nav", label: "open_travel_tool", screen: "tools" }} />
          <ActionButton title="Coûts" variant="ghost" onPress={() => router.push("/tools/costs")} style={{ flex: 1 }} track={{ type: "nav", label: "open_costs_tool", screen: "tools" }} />
          <ActionButton title="Refus / Plan B" variant="ghost" onPress={() => router.push("/tools/refusal")} style={{ flex: 1 }} track={{ type: "nav", label: "open_refusal_tool", screen: "tools" }} />
        </View>
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Propositions de visa</Text>
        <Text style={styles.body}>Voir les visas potentiellement accessibles + score et pistes d’amélioration.</Text>
        <View style={{ height: Tokens.space.md }} />
        <ActionButton title="Ouvrir" variant="ghost" onPress={() => router.push("/(tabs)/eligibility")} track={{ type: "nav", label: "open_eligibility", screen: "tools" }} />
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Ambassades & consulats</Text>
        <Text style={styles.body}>Trouver une ambassade/consulat/TLS/VFS (liste + filtres) et ouvrir l’itinéraire.</Text>
        <View style={{ height: Tokens.space.md }} />
        <ActionButton title="Ouvrir" variant="ghost" onPress={() => router.push("/(tabs)/offices")} track={{ type: "nav", label: "open_offices", screen: "tools" }} />
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Actualités visa & lois</Text>
        <Text style={styles.body}>Flux par pays, catégories et tags (avec sources et avertissements).</Text>
        <View style={{ height: Tokens.space.md }} />
        <ActionButton title="Ouvrir" variant="ghost" onPress={() => router.push("/(tabs)/news")} track={{ type: "nav", label: "open_news", screen: "tools" }} />
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Rendez-vous & rappels</Text>
        <Text style={styles.body}>Créer des rappels et suivre les délais.</Text>
        <View style={{ height: Tokens.space.md }} />
        <ActionButton title="Ouvrir" variant="ghost" onPress={() => router.push("/(tabs)/appointments")} track={{ type: "nav", label: "open_appointments", screen: "tools" }} />
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Travel Intelligence (simulation)</Text>
        <Text style={styles.body}>Générer un itinéraire “visa‑compliant” (sans réservation) + alertes de cohérence.</Text>
        <View style={{ height: Tokens.space.md }} />
        <ActionButton title="Ouvrir" variant="ghost" onPress={() => router.push("/tools/travel")} track={{ type: "nav", label: "open_travel_tool", screen: "tools" }} />
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Estimation des coûts</Text>
        <Text style={styles.body}>Calcule un total à partir des montants officiels + détecte des frais suspects.</Text>
        <View style={{ height: Tokens.space.md }} />
        <ActionButton title="Ouvrir" variant="ghost" onPress={() => router.push("/tools/costs")} track={{ type: "nav", label: "open_costs_tool", screen: "tools" }} />
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Refus: explication + plan B</Text>
        <Text style={styles.body}>Analyse les motifs et sort une liste d’actions vérifiables + alternatives.</Text>
        <View style={{ height: Tokens.space.md }} />
        <ActionButton title="Ouvrir" variant="ghost" onPress={() => router.push("/tools/refusal")} track={{ type: "nav", label: "open_refusal_tool", screen: "tools" }} />
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Abonnements & paiement</Text>
        <Text style={styles.body}>Choisir un plan et payer via checkout (MVP).</Text>
        <View style={{ height: Tokens.space.md }} />
        <ActionButton title="Voir les plans" variant="ghost" onPress={() => router.push("/(tabs)/billing")} track={{ type: "nav", label: "open_billing", screen: "tools" }} />
      </GlassCard>

      {process.env.EXPO_PUBLIC_ADMIN_MODE === "1" ? (
        <GlassCard>
          <Text style={styles.cardTitle}>Admin</Text>
          <Text style={styles.body}>Éditer les règles d’éligibilité (mode admin).</Text>
          <View style={{ height: Tokens.space.md }} />
          <ActionButton title="Règles éligibilité" variant="ghost" onPress={() => router.push("/(tabs)/admin_rules")} track={{ type: "nav", label: "open_admin_rules", screen: "tools" }} />
        </GlassCard>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { color: Colors.text, fontSize: Tokens.font.size.lg, fontWeight: Tokens.font.weight.bold },
  body: { marginTop: Tokens.space.sm, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  rowButtons: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  row: { flexDirection: "row", gap: 10, marginTop: Tokens.space.sm, alignItems: "flex-start" },
  dot: { width: 10, height: 10, borderRadius: 99, marginTop: 6 },
  text: { flex: 1, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
});

