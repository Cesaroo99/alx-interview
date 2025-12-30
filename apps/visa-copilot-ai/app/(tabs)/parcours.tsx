import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";
import { useProfile } from "@/src/state/profile";

type StepStatus = "not_started" | "in_progress" | "done" | "blocked";

function statusLabel(s: StepStatus) {
  switch (s) {
    case "done":
      return "Terminé";
    case "in_progress":
      return "En cours";
    case "blocked":
      return "Bloqué";
    default:
      return "Non commencé";
  }
}

function statusColor(s: StepStatus) {
  switch (s) {
    case "done":
      return Colors.success;
    case "in_progress":
      return Colors.warning;
    case "blocked":
      return Colors.danger;
    default:
      return Colors.faint;
  }
}

export default function ParcoursScreen() {
  const { profile } = useProfile();

  const steps = useMemo(() => {
    const hasProfile = !!profile?.nationality && !!profile?.profession;
    const s1: StepStatus = hasProfile ? "done" : "in_progress";
    const s2: StepStatus = hasProfile ? "in_progress" : "blocked";
    const s3: StepStatus = hasProfile ? "not_started" : "blocked";
    const s4: StepStatus = hasProfile ? "not_started" : "blocked";
    const s5: StepStatus = hasProfile ? "not_started" : "blocked";
    const s6: StepStatus = hasProfile ? "not_started" : "blocked";

    return [
      { key: "visa", title: "Choix du visa", status: s1, action: () => router.push("/(tabs)/eligibility") },
      { key: "docs", title: "Documents", status: s2, action: () => router.push("/(tabs)/documents") },
      { key: "forms", title: "Itinéraire & cohérence", status: s3, action: () => router.push("/tools/travel") },
      { key: "pay", title: "Coûts & paiements officiels", status: s4, action: () => router.push("/tools/costs") },
      { key: "appt", title: "Rendez-vous", status: s5, action: () => router.push("/(tabs)/appointments") },
      { key: "submit", title: "Dépôt & suivi", status: s6, action: () => router.push("/(tabs)/dossier") },
    ];
  }, [profile]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Parcours visa</Text>
        <Text style={styles.subtitle}>Une timeline simple, avec blocage intelligent quand une étape n’est pas prête.</Text>
      </View>

      <GlassCard>
        <Text style={styles.cardTitle}>Timeline</Text>
        <View style={{ height: Tokens.space.sm }} />
        {steps.map((s, idx) => (
          <View key={s.key} style={styles.stepRow}>
            <View style={styles.left}>
              <View style={[styles.dot, { backgroundColor: statusColor(s.status) }]} />
              {idx < steps.length - 1 ? <View style={styles.line} /> : null}
            </View>
            <View style={styles.right}>
              <View style={styles.stepTop}>
                <Text style={styles.stepTitle}>{s.title}</Text>
                <View style={[styles.badge, { borderColor: `${statusColor(s.status)}66` }]}>
                  <Text style={styles.badgeText}>{statusLabel(s.status)}</Text>
                </View>
              </View>
              <PrimaryButton
                title={s.status === "blocked" ? "Compléter l’étape précédente" : "Ouvrir"}
                variant="ghost"
                onPress={() => s.action()}
                style={{ marginTop: Tokens.space.sm, opacity: s.status === "blocked" ? 0.7 : 1 }}
              />
            </View>
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
  stepRow: { flexDirection: "row", gap: Tokens.space.md, marginTop: Tokens.space.lg },
  left: { width: 22, alignItems: "center" },
  dot: { width: 12, height: 12, borderRadius: 99 },
  line: { width: 2, flex: 1, backgroundColor: "rgba(255,255,255,0.10)", marginTop: 8, borderRadius: 99 },
  right: { flex: 1 },
  stepTop: { flexDirection: "row", gap: 10, alignItems: "center" },
  stepTitle: { color: Colors.text, fontSize: Tokens.font.size.lg, fontWeight: Tokens.font.weight.bold, flex: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, backgroundColor: Colors.card2 },
  badgeText: { color: Colors.muted, fontSize: Tokens.font.size.xs, fontWeight: Tokens.font.weight.semibold },
});

