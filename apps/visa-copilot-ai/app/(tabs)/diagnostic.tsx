import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Api, type DiagnosticResponse } from "@/src/api/client";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { AnimatedIn } from "@/src/ui/AnimatedIn";
import { GlassCard } from "@/src/ui/GlassCard";
import { Screen } from "@/src/ui/Screen";
import { SkeletonCard } from "@/src/ui/Skeleton";
import { ScorePill } from "@/src/ui/ScorePill";
import { ScoreBar } from "@/src/ui/ScoreBar";
import { useProfile } from "@/src/state/profile";

export default function DiagnosticScreen() {
  const { profile } = useProfile();
  const [data, setData] = useState<DiagnosticResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!profile) return;
      setLoading(true);
      setError(null);
      try {
        const res = await Api.diagnose(profile);
        if (!cancelled) setData(res);
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Diagnostic visa</Text>
        <Text style={styles.subtitle}>
          Scores + explications. Objectif: augmenter la probabilité de succès avant dépôt.
        </Text>
      </View>

      <AnimatedIn delayMs={0}>
        <GlassCard>
          <Text style={styles.cardTitle}>Scores</Text>
          <View style={{ height: Tokens.space.md }} />
          {loading ? (
            <View style={{ gap: Tokens.space.md }}>
              <View style={styles.loadingRow}>
                <ActivityIndicator />
                <Text style={styles.loadingText}>Analyse du profil…</Text>
              </View>
              <SkeletonCard />
            </View>
          ) : error ? (
            <Text style={styles.error}>
              {error}
              {"\n"}
              Astuce: démarrez l’API FastAPI et définissez `EXPO_PUBLIC_API_BASE_URL`.
            </Text>
          ) : data ? (
            <>
              <ScorePill label="Readiness" value={data.readiness_score} />
              <View style={{ height: Tokens.space.sm }} />
              <ScoreBar value01={data.readiness_score / 100} kind="readiness" />
              <View style={{ height: Tokens.space.md }} />
              <ScorePill label="Risque refus" value={data.refusal_risk_score} kind="risk" />
              <View style={{ height: Tokens.space.sm }} />
              <ScoreBar value01={data.refusal_risk_score} kind="risk" />
              <View style={{ height: Tokens.space.sm }} />
              <Text style={styles.meta}>Difficulté: {data.difficulty_level}</Text>
            </>
          ) : (
            <Text style={styles.meta}>Aucun profil chargé.</Text>
          )}
        </GlassCard>
      </AnimatedIn>

      {data ? (
        <>
          <AnimatedIn delayMs={80}>
            <GlassCard>
              <Text style={styles.cardTitle}>Risques clés</Text>
              <View style={{ height: Tokens.space.sm }} />
              {data.key_risks.map((r) => (
                <View key={r} style={styles.row}>
                  <View style={[styles.badge, { backgroundColor: "rgba(255,77,109,0.20)" }]} />
                  <Text style={styles.text}>{r}</Text>
                </View>
              ))}
            </GlassCard>
          </AnimatedIn>

          <AnimatedIn delayMs={140}>
            <GlassCard>
              <Text style={styles.cardTitle}>Prochaines actions (visa-first)</Text>
              <View style={{ height: Tokens.space.sm }} />
              {data.next_best_actions.map((a) => (
                <View key={a} style={styles.row}>
                  <View style={[styles.badge, { backgroundColor: "rgba(46,233,255,0.18)" }]} />
                  <Text style={styles.text}>{a}</Text>
                </View>
              ))}
            </GlassCard>
          </AnimatedIn>

          <AnimatedIn delayMs={200}>
            <GlassCard>
              <Text style={styles.cardTitle}>Protection anti-scam</Text>
              <View style={{ height: Tokens.space.sm }} />
              {data.anti_scam_warnings.map((w) => (
                <View key={w} style={styles.row}>
                  <View style={[styles.badge, { backgroundColor: "rgba(255,176,32,0.18)" }]} />
                  <Text style={styles.text}>{w}</Text>
                </View>
              ))}
            </GlassCard>
          </AnimatedIn>
        </>
      ) : null}
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
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  loadingText: { color: Colors.muted, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.medium },
  error: { color: Colors.warning, fontSize: Tokens.font.size.md, lineHeight: 22 },
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

