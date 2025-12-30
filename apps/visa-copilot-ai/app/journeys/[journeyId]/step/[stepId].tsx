import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { router } from "expo-router";

import { Api, type Journey, type JourneyStep } from "@/src/api/client";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { HeroBanner } from "@/src/ui/HeroBanner";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";
import { useDocuments } from "@/src/state/documents";
import { useProfile } from "@/src/state/profile";
import { buildJourneyContext } from "@/src/telemetry/journeyContext";

function pickLabel(obj: any, locale: "fr" | "en") {
  if (obj && typeof obj === "object") return obj[locale] || obj.fr || obj.en || Object.values(obj)[0];
  return String(obj || "");
}

export default function JourneyStepScreen() {
  const { journeyId, stepId } = useLocalSearchParams<{ journeyId: string; stepId: string }>();
  const jid = String(journeyId || "");
  const sid = String(stepId || "");
  const { profile } = useProfile();
  const { docs } = useDocuments();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [steps, setSteps] = useState<JourneyStep[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const j = await Api.getJourney(jid);
        const s = await Api.listJourneySteps(jid);
        if (!cancelled) {
          setJourney(j.journey);
          setSteps(s.items || []);
        }
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jid, sid]);

  const locale = (journey?.locale === "en" ? "en" : "fr") as "fr" | "en";
  const step = useMemo(() => steps.find((x) => x.id === sid) || null, [steps, sid]);
  const actions = (step?.payload?.actions || []) as any[];
  const resources = (step?.payload?.resources || []) as any[];
  const suggestions = (step?.payload?.suggestions || []) as any[];

  return (
    <Screen>
      <HeroBanner
        kicker={locale === "fr" ? "Étape" : "Step"}
        title={step ? pickLabel(step.title, locale) : sid}
        subtitle={step ? step.status : jid}
      />

      {error ? (
        <GlassCard>
          <Text style={styles.error}>{error}</Text>
        </GlassCard>
      ) : null}

      {loading ? (
        <GlassCard>
          <View style={styles.loadingRow}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>{locale === "fr" ? "Chargement…" : "Loading…"}</Text>
          </View>
        </GlassCard>
      ) : null}

      {step ? (
        <>
          {pickLabel(step.description, locale) ? (
            <GlassCard>
              <Text style={styles.cardTitle}>{locale === "fr" ? "Contexte" : "Context"}</Text>
              <Text style={styles.body}>{pickLabel(step.description, locale)}</Text>
            </GlassCard>
          ) : null}

          {resources.length ? (
            <GlassCard>
              <Text style={styles.cardTitle}>{locale === "fr" ? "Ressources" : "Resources"}</Text>
              <View style={{ height: Tokens.space.sm }} />
              {resources.slice(0, 6).map((r) => (
                <View key={JSON.stringify(r)} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepTitle}>{pickLabel(r.title, locale) || r.type}</Text>
                    <Text style={styles.stepMeta}>{String(r.url || "")}</Text>
                  </View>
                  <PrimaryButton title={locale === "fr" ? "Ouvrir" : "Open"} variant="ghost" onPress={() => (r.url ? Linking.openURL(String(r.url)) : undefined)} />
                </View>
              ))}
            </GlassCard>
          ) : null}

          {suggestions.length ? (
            <GlassCard>
              <Text style={styles.cardTitle}>{locale === "fr" ? "Suggestions" : "Suggestions"}</Text>
              <View style={{ height: Tokens.space.sm }} />
              {suggestions.slice(0, 6).map((s) => (
                <View key={JSON.stringify(s)} style={{ marginTop: Tokens.space.md }}>
                  <Text style={styles.stepTitle}>{String(s.field || "champ")}</Text>
                  <Text style={styles.body}>{pickLabel(s.text, locale)}</Text>
                  {s.why ? <Text style={styles.stepMeta}>{pickLabel(s.why, locale)}</Text> : null}
                </View>
              ))}
            </GlassCard>
          ) : null}

          <GlassCard>
            <Text style={styles.cardTitle}>{locale === "fr" ? "Actions" : "Actions"}</Text>
            <View style={{ height: Tokens.space.sm }} />
            {actions.length ? (
              actions.slice(0, 6).map((a) => (
                <PrimaryButton
                  key={JSON.stringify(a)}
                  title={pickLabel(a.label, locale) || a.type}
                  variant="ghost"
                  onPress={async () => {
                    const res = await Api.journeyAct({
                      journey_id: jid,
                      locale,
                      context: buildJourneyContext(profile, docs),
                      action: { type: a.type || "action", label: pickLabel(a.label, locale), target: a.target || null, step_key: step.step_key },
                    });
                    // refresh local snapshot
                    setJourney(res.journey);
                    setSteps(res.steps || []);
                    if (a.type === "open_url" && a.target) {
                      await Linking.openURL(String(a.target));
                    }
                  }}
                />
              ))
            ) : (
              <Text style={styles.body}>{locale === "fr" ? "Aucune action suggérée." : "No suggested actions."}</Text>
            )}

            <View style={{ height: Tokens.space.md }} />
            <View style={styles.row2}>
              <PrimaryButton title={locale === "fr" ? "Retour" : "Back"} variant="ghost" onPress={() => router.back()} style={{ flex: 1 }} />
              <PrimaryButton
                title={locale === "fr" ? "Marquer terminé" : "Mark done"}
                variant="ghost"
                onPress={async () => {
                  await Api.journeyCompleteStep({ journey_id: jid, step_id: sid, locale, context: buildJourneyContext(profile, docs) });
                  router.replace(`/journeys/${jid}`);
                }}
                style={{ flex: 1 }}
              />
            </View>
          </GlassCard>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  loadingText: { color: Colors.muted, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.medium },
  cardTitle: { color: Colors.text, fontSize: Tokens.font.size.lg, fontWeight: Tokens.font.weight.bold },
  body: { marginTop: Tokens.space.sm, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  error: { color: Colors.warning, fontSize: Tokens.font.size.md, lineHeight: 22 },
  row: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: Tokens.space.md },
  row2: { flexDirection: "row", gap: 10, alignItems: "center" },
  stepTitle: { color: Colors.text, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.bold },
  stepMeta: { marginTop: 4, color: Colors.faint, fontSize: Tokens.font.size.sm },
});

