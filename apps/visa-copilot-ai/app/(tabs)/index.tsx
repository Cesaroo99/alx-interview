import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { Mock } from "@/src/mock/data";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";
import { ScorePill } from "@/src/ui/ScorePill";
import { useProfile } from "@/src/state/profile";

export default function HomeScreen() {
  const { profile, clearProfile } = useProfile();
  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.kicker}>Visa Copilot AI</Text>
        <Text style={styles.title}>Votre copilote IA pour réussir votre visa.</Text>
        <Text style={styles.subtitle}>
          Guidance 100% officielle. Explications “pourquoi”. Prévention des refus et protection anti-scam.
        </Text>
      </View>

      <GlassCard>
        <Text style={styles.cardTitle}>Résumé (démo)</Text>
        <View style={{ height: Tokens.space.md }} />
        <ScorePill label="Readiness" value={Mock.diagnostic.readiness_score} />
        <View style={{ height: Tokens.space.sm }} />
        <ScorePill label="Risque refus" value={Mock.diagnostic.refusal_risk_score} kind="risk" />
        <View style={{ height: Tokens.space.lg }} />
        <PrimaryButton title="Voir le diagnostic" onPress={() => router.push("/(tabs)/diagnostic")} />
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Actions prioritaires</Text>
        <View style={{ height: Tokens.space.sm }} />
        {Mock.diagnostic.next_best_actions.slice(0, 3).map((a) => (
          <View key={a} style={styles.bulletRow}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>{a}</Text>
          </View>
        ))}
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Principe “official-only”</Text>
        <Text style={styles.body}>
          L’app ne soumet rien à votre place. Elle guide et vérifie. Les formulaires et paiements restent sur les portails
          officiels.
        </Text>
        <View style={{ height: Tokens.space.md }} />
        <PrimaryButton title="Vérifier une URL (anti-scam)" onPress={() => router.push("/(tabs)/security")} variant="ghost" />
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Profil</Text>
        <Text style={styles.body}>
          {profile ? `${profile.nationality} · ${profile.age} ans · ${profile.profession}` : "Aucun profil"}
        </Text>
        <View style={{ height: Tokens.space.md }} />
        <PrimaryButton
          title="Réinitialiser le profil"
          variant="ghost"
          onPress={async () => {
            await clearProfile();
            router.replace("/onboarding");
          }}
        />
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: 10,
  },
  kicker: {
    color: Colors.brandB,
    fontWeight: Tokens.font.weight.semibold,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontSize: Tokens.font.size.xs,
  },
  title: {
    color: Colors.text,
    fontSize: Tokens.font.size.hero,
    fontWeight: Tokens.font.weight.black,
    lineHeight: 38,
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
  body: {
    marginTop: Tokens.space.sm,
    color: Colors.muted,
    fontSize: Tokens.font.size.md,
    lineHeight: 22,
  },
  bulletRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: Tokens.space.sm,
    alignItems: "flex-start",
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
    marginTop: 6,
    backgroundColor: Colors.brandA,
  },
  bulletText: {
    flex: 1,
    color: Colors.muted,
    fontSize: Tokens.font.size.md,
    lineHeight: 22,
  },
});
