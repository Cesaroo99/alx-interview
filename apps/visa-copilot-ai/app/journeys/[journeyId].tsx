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
import { ProgressBar } from "@/src/ui/ProgressBar";
import { Screen } from "@/src/ui/Screen";
import { useDocuments } from "@/src/state/documents";
import { useI18n } from "@/src/state/i18n";
import { useJourney } from "@/src/state/journey";
import { useProfile } from "@/src/state/profile";
import { buildJourneyContext } from "@/src/telemetry/journeyContext";

function pickLabel(obj: any, locale: "fr" | "en") {
  if (obj && typeof obj === "object") return obj[locale] || obj.fr || obj.en || Object.values(obj)[0];
  return String(obj || "");
}

function badgeToneForStatus(status: string): { dot: string; labelTone: "success" | "warning" | "danger" | "neutral" } {
  if (status === "done") return { dot: Colors.success, labelTone: "success" };
  if (status === "in_progress") return { dot: Colors.brandB, labelTone: "warning" };
  if (status === "blocked") return { dot: Colors.danger, labelTone: "danger" };
  return { dot: Colors.faint, labelTone: "neutral" };
}

export default function JourneyDetail() {
  const { journeyId } = useLocalSearchParams<{ journeyId: string }>();
  const jid = String(journeyId || "");
  const { profile } = useProfile();
  const { docs } = useDocuments();
  const journeyState = useJourney();
  const i18n = useI18n();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [steps, setSteps] = useState<JourneyStep[]>([]);
  const [aiInfo, setAiInfo] = useState<any>(null);

  const locale = (journey?.locale === "en" ? "en" : "fr") as "fr" | "en";

  async function refresh() {
    const j = await Api.getJourney(jid);
    const s = await Api.listJourneySteps(jid);
    setJourney(j.journey);
    setSteps(s.items || []);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await refresh();
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jid]);

  const next = useMemo(() => steps.find((s) => s.status === "in_progress") || steps.find((s) => s.status === "not_started") || steps[0], [steps]);

  const progress = useMemo(() => {
    const total = steps.length || 0;
    const done = steps.filter((s) => s.status === "done").length;
    const inProgress = steps.filter((s) => s.status === "in_progress").length;
    const blocked = steps.filter((s) => s.status === "blocked").length;
    const notStarted = steps.filter((s) => s.status === "not_started").length;
    const errors: string[] = [];
    const warnings: string[] = [];
    for (const s of steps) {
      const alerts = (s.payload?.alerts || []) as any[];
      for (const a of alerts) {
        const txt = pickLabel(a?.text, locale);
        if (!txt) continue;
        if (a?.level === "error") errors.push(txt);
        else if (a?.level === "warning") warnings.push(txt);
      }
    }
    return { total, done, inProgress, blocked, notStarted, errors: errors.slice(0, 6), warnings: warnings.slice(0, 6) };
  }, [steps, locale]);

  return (
    <Screen>
      <HeroBanner
        kicker={locale === "fr" ? "Parcours" : "Journey"}
        title={pickLabel(journey?.plan?.title, locale) || (locale === "fr" ? "Détails" : "Details")}
        subtitle={pickLabel(journey?.plan?.objective, locale) || jid}
      />

      {error ? (
        <GlassCard>
          <Text style={styles.error}>{error}</Text>
        </GlassCard>
      ) : null}

      <GlassCard>
        <Text style={styles.cardTitle}>{locale === "fr" ? "Progression" : "Progress"}</Text>
        <View style={{ height: Tokens.space.sm }} />
        <ProgressBar step={progress.done} total={Math.max(progress.total, 1)} />
        <Text style={styles.body}>
          {locale === "fr"
            ? `${progress.done}/${progress.total} terminées · ${progress.inProgress} en cours · ${progress.blocked} bloquées`
            : `${progress.done}/${progress.total} done · ${progress.inProgress} in progress · ${progress.blocked} blocked`}
        </Text>

        {progress.errors.length ? (
          <View style={{ marginTop: Tokens.space.md }}>
            <Text style={[styles.stepTitle, { color: Colors.danger }]}>{locale === "fr" ? "Blocages" : "Blockers"}</Text>
            {progress.errors.map((x) => (
              <Text key={x} style={styles.body}>
                ⛔ {x}
              </Text>
            ))}
          </View>
        ) : null}

        {progress.warnings.length ? (
          <View style={{ marginTop: Tokens.space.md }}>
            <Text style={[styles.stepTitle, { color: Colors.warning }]}>{locale === "fr" ? "Alertes" : "Warnings"}</Text>
            {progress.warnings.map((x) => (
              <Text key={x} style={styles.body}>
                ⚠️ {x}
              </Text>
            ))}
          </View>
        ) : null}
      </GlassCard>

      <GlassCard>
        <View style={styles.rowTop}>
          <Text style={styles.cardTitle}>{locale === "fr" ? "Étapes" : "Steps"}</Text>
          {loading ? <ActivityIndicator /> : null}
        </View>
        <View style={{ height: Tokens.space.sm }} />

        {steps.map((s) => (
          <View key={s.id} style={styles.stepRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>
                {s.ordering}. {pickLabel(s.title, locale) || s.step_key}
              </Text>
              <Text style={styles.stepMeta}>{s.status}</Text>
              {pickLabel(s.description, locale) ? <Text style={styles.body}>{pickLabel(s.description, locale)}</Text> : null}
              {(s.payload?.alerts || []).slice(0, 2).map((a: any) => (
                <Text key={JSON.stringify(a)} style={[styles.body, { color: a.level === "error" ? Colors.danger : a.level === "warning" ? Colors.warning : Colors.muted }]}>
                  {a.level?.toUpperCase?.() || "INFO"} — {pickLabel(a.text, locale)}
                </Text>
              ))}
            </View>
            <View style={{ gap: 8, alignItems: "flex-end" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 99,
                    backgroundColor: badgeToneForStatus(String(s.status || "")).dot,
                  }}
                />
                <Text style={styles.stepMeta}>{String(s.status || "")}</Text>
              </View>
              <PrimaryButton
                title={locale === "fr" ? "Actions" : "Actions"}
                variant="ghost"
                onPress={() => router.push(`/journeys/${jid}/step/${s.id}`)}
              />
              <PrimaryButton
                title={locale === "fr" ? "Terminer" : "Done"}
                variant="ghost"
                onPress={async () => {
                  const res = await Api.journeyCompleteStep({ journey_id: jid, step_id: s.id, locale, context: buildJourneyContext(profile, docs) });
                  setAiInfo(res.ai);
                  setJourney(res.journey);
                  setSteps(res.steps || []);
                }}
                style={{ opacity: s.status === "done" ? 0.6 : 1 }}
              />
            </View>
          </View>
        ))}
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>{locale === "fr" ? "Que faire maintenant ?" : "What now?"}</Text>
        <Text style={styles.body}>
          {locale === "fr"
            ? "Chaque clic peut mettre à jour le parcours. Exemple: \"J’ai ajouté un document\", \"J’ai pris rendez‑vous\", etc."
            : "Each click can update the plan. Example: “I added a document”, “I booked an appointment”, etc."}
        </Text>
        <View style={{ height: Tokens.space.md }} />
        <PrimaryButton
          title={locale === "fr" ? "Demander à l’IA" : "Ask AI"}
          onPress={async () => {
            const res = await Api.journeyAct({
              journey_id: jid,
              locale,
              context: buildJourneyContext(profile, docs),
              action: { type: "user_click", label: "ask_next", screen: "journey.detail", step_key: next?.step_key || null },
            });
            setAiInfo(res.ai);
            setJourney(res.journey);
            setSteps(res.steps || []);
          }}
        />
        {aiInfo?.next ? (
          <View style={{ marginTop: Tokens.space.md }}>
            <Text style={styles.stepTitle}>
              {locale === "fr" ? "Prochaine étape" : "Next step"}: {aiInfo.next.step_key}
            </Text>
          </View>
        ) : null}
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>{locale === "fr" ? "Parcours actif" : "Active journey"}</Text>
        <Text style={styles.body}>
          {locale === "fr"
            ? "Activer ce parcours permet au suivi automatique de capturer les clics importants dans l’app."
            : "Activating this journey enables automatic tracking of key clicks across the app."}
        </Text>
        <View style={{ height: Tokens.space.md }} />
        <PrimaryButton
          title={locale === "fr" ? "Définir comme actif" : "Set as active"}
          variant="ghost"
          onPress={async () => {
            await journeyState.setActiveJourneyId(jid);
            await i18n.setLocale(locale);
          }}
        />
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { color: Colors.text, fontSize: Tokens.font.size.lg, fontWeight: Tokens.font.weight.bold },
  body: { marginTop: Tokens.space.sm, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  error: { color: Colors.warning, fontSize: Tokens.font.size.md, lineHeight: 22 },
  stepRow: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginTop: Tokens.space.lg },
  stepTitle: { color: Colors.text, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.bold },
  stepMeta: { marginTop: 4, color: Colors.faint, fontSize: Tokens.font.size.sm },
});

