import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { router } from "expo-router";

import { Api, type Procedure, type ProcedureStep } from "@/src/api/client";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { HeroBanner } from "@/src/ui/HeroBanner";
import { ActionButton } from "@/src/ui/ActionButton";
import { Screen } from "@/src/ui/Screen";

function pickLabel(obj: any, locale: "fr" | "en") {
  if (obj && typeof obj === "object") return obj[locale] || obj.fr || obj.en || Object.values(obj)[0];
  return "";
}

export default function ProcedureDetail() {
  const { procedureId } = useLocalSearchParams<{ procedureId: string }>();
  const pid = String(procedureId || "");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proc, setProc] = useState<Procedure | null>(null);
  const [steps, setSteps] = useState<ProcedureStep[]>([]);
  const locale = (proc?.locale === "en" ? "en" : "fr") as "fr" | "en";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const all = await Api.listProcedures();
        const found = (all.items || []).find((x) => x.id === pid) || null;
        const s = await Api.listProcedureSteps(pid);
        if (!cancelled) {
          setProc(found);
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
  }, [pid]);

  const current = useMemo(() => steps.find((s) => s.status === "in_progress") || steps[0], [steps]);

  return (
    <Screen>
      <HeroBanner
        kicker={locale === "fr" ? "Démarche" : "Procedure"}
        title={locale === "fr" ? "Suivi" : "Tracking"}
        subtitle={proc ? `${proc.type} · ${proc.country} · ${proc.intent}` : pid}
      />

      <GlassCard>
        <View style={styles.rowTop}>
          <Text style={styles.cardTitle}>{locale === "fr" ? "Étapes" : "Steps"}</Text>
          {loading ? <ActivityIndicator /> : null}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={{ height: Tokens.space.sm }} />

        {steps.map((s) => (
          <View key={s.id} style={styles.stepRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>
                {s.ordering}. {pickLabel(s.title, locale) || s.step_key}
              </Text>
              <Text style={styles.stepMeta}>{s.status}</Text>
            </View>
            <ActionButton
              title={locale === "fr" ? "Ouvrir" : "Open"}
              variant={s.status === "done" ? "ghost" : "brand"}
              onPress={() => router.push(`/forms/${pid}/step/${s.id}`)}
              track={{ type: "nav", label: "open_procedure_step", screen: "forms.detail", target: s.step_key }}
            />
          </View>
        ))}
      </GlassCard>

      {current?.official_url ? (
        <GlassCard>
          <Text style={styles.cardTitle}>{locale === "fr" ? "Soumission officielle" : "Official submission"}</Text>
          <Text style={styles.body}>
            {locale === "fr"
              ? "L’app ne soumet rien. Ouvrez le site officiel et copiez-collez les champs."
              : "The app never submits. Open the official site and copy-paste fields."}
          </Text>
          <View style={{ height: Tokens.space.md }} />
          <ActionButton
            title={locale === "fr" ? "Ouvrir le site officiel" : "Open official site"}
            onPress={() => Linking.openURL(String(current.official_url))}
            track={{ type: "external", label: "open_official_site", screen: "forms.detail", target: String(current.official_url) }}
          />
        </GlassCard>
      ) : null}

      <GlassCard>
        <Text style={styles.cardTitle}>{locale === "fr" ? "Audit & décisions IA" : "Audit & AI decisions"}</Text>
        <Text style={styles.body}>
          {locale === "fr"
            ? "Consultez les décisions IA, validations et sauvegardes (traçabilité)."
            : "View AI decisions, validations, saves (traceability)."}
        </Text>
        <View style={{ height: Tokens.space.md }} />
        <ActionButton
          title={locale === "fr" ? "Voir l’audit" : "View audit"}
          variant="ghost"
          onPress={() => router.push(`/forms/${pid}/audit`)}
          track={{ type: "nav", label: "open_audit", screen: "forms.detail", target: pid }}
        />
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { color: Colors.text, fontSize: Tokens.font.size.lg, fontWeight: Tokens.font.weight.bold },
  body: { marginTop: Tokens.space.sm, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  error: { marginTop: Tokens.space.sm, color: Colors.warning, fontSize: Tokens.font.size.md, lineHeight: 22 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stepRow: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: Tokens.space.md },
  stepTitle: { color: Colors.text, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.bold },
  stepMeta: { marginTop: 4, color: Colors.faint, fontSize: Tokens.font.size.sm },
});

