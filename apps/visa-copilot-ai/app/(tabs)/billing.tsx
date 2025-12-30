import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";

import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";

type PlanKey = "basic" | "premium" | "pro";

const PLANS: Array<{ key: PlanKey; title: string; price: string; bullets: string[] }> = [
  { key: "basic", title: "Basic", price: "5€/mois", bullets: ["Diagnostic + parcours", "Checklists de base", "Anti-scam"] },
  { key: "premium", title: "Premium", price: "12€/mois", bullets: ["Tout Basic", "Scoring dossier avancé", "Copilot prioritaire"] },
  { key: "pro", title: "Pro", price: "29€/mois", bullets: ["Tout Premium", "Multi-dossiers", "Support prioritaire"] },
];

export default function BillingScreen() {
  const [selected, setSelected] = useState<PlanKey>("premium");
  const checkoutUrl = useMemo(() => {
    // MVP: lien placeholder. Prochaine itération: backend qui crée une session Flutterwave + webhooks.
    return "https://flutterwave.com/pay";
  }, []);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Abonnements</Text>
        <Text style={styles.subtitle}>Paiement intégré (MVP). Les frais visa officiels restent sur les canaux officiels.</Text>
      </View>

      {PLANS.map((p) => (
        <GlassCard key={p.key} style={[p.key === selected ? styles.selected : null]}>
          <View style={styles.planTop}>
            <Text style={styles.planTitle}>{p.title}</Text>
            <Text style={styles.price}>{p.price}</Text>
          </View>
          <View style={{ height: Tokens.space.sm }} />
          {p.bullets.map((b) => (
            <View key={b} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: Colors.brandB }]} />
              <Text style={styles.text}>{b}</Text>
            </View>
          ))}
          <View style={{ height: Tokens.space.md }} />
          <PrimaryButton title={p.key === selected ? "Sélectionné" : "Choisir"} variant={p.key === selected ? "brand" : "ghost"} onPress={() => setSelected(p.key)} />
        </GlassCard>
      ))}

      <GlassCard>
        <Text style={styles.cardTitle}>Paiement</Text>
        <Text style={styles.body}>Vous allez payer l’abonnement GlobalVisa via Flutterwave (checkout). MVP: lien de démo.</Text>
        <View style={{ height: Tokens.space.lg }} />
        <PrimaryButton
          title="Payer maintenant"
          onPress={async () => {
            await WebBrowser.openBrowserAsync(checkoutUrl);
          }}
        />
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 8 },
  title: { color: Colors.text, fontSize: Tokens.font.size.xxl, fontWeight: Tokens.font.weight.black },
  subtitle: { color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  selected: { borderColor: "rgba(46,233,255,0.35)", backgroundColor: "rgba(46,233,255,0.06)" },
  planTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  planTitle: { color: Colors.text, fontSize: Tokens.font.size.xl, fontWeight: Tokens.font.weight.black },
  price: { color: Colors.brandB, fontSize: Tokens.font.size.lg, fontWeight: Tokens.font.weight.bold },
  row: { flexDirection: "row", gap: 10, marginTop: Tokens.space.sm, alignItems: "flex-start" },
  dot: { width: 10, height: 10, borderRadius: 99, marginTop: 6 },
  text: { flex: 1, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  cardTitle: { color: Colors.text, fontSize: Tokens.font.size.lg, fontWeight: Tokens.font.weight.bold },
  body: { marginTop: Tokens.space.sm, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
});

