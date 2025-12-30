import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, TextInput, View } from "react-native";
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

function pickLabel(obj: any, locale: "fr" | "en") {
  if (obj && typeof obj === "object") return obj[locale] || obj.fr || obj.en || Object.values(obj)[0];
  return String(obj || "");
}

function buildContext(profile: any, docs: any[]) {
  return {
    profile: profile || null,
    documents: (docs || []).slice(0, 20).map((d) => ({
      id: d.id,
      doc_type: d.doc_type,
      filename: d.filename,
      extracted: d.extracted || {},
    })),
  };
}

export default function ParcoursScreen() {
  const { profile } = useProfile();
  const { docs } = useDocuments();

  const [locale, setLocale] = useState<"fr" | "en">("fr");
  const [type, setType] = useState<"visa" | "admission" | "admin">("visa");
  const [intent, setIntent] = useState("tourism");
  const [country, setCountry] = useState("schengen");
  const [target, setTarget] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [journeys, setJourneys] = useState<Journey[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await Api.listJourneys();
        if (!cancelled) setJourneys(res.items || []);
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Screen>
      <HeroBanner
        kicker={locale === "fr" ? "Auto‑adaptatif" : "Auto‑adaptive"}
        title={locale === "fr" ? "Parcours dynamique" : "Dynamic journey"}
        subtitle={
          locale === "fr"
            ? "Chaque action devient une question à l’IA. L’IA génère et met à jour le chemin."
            : "Each action becomes a question to the AI. The AI generates and updates your path."
        }
      />

      <GlassCard>
        <Text style={styles.cardTitle}>{locale === "fr" ? "Langue" : "Language"}</Text>
        <View style={{ height: Tokens.space.sm }} />
        <View style={styles.row2}>
          <PrimaryButton title="FR" variant={locale === "fr" ? "brand" : "ghost"} onPress={() => setLocale("fr")} style={{ flex: 1 }} />
          <PrimaryButton title="EN" variant={locale === "en" ? "brand" : "ghost"} onPress={() => setLocale("en")} style={{ flex: 1 }} />
        </View>
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>{locale === "fr" ? "Créer un objectif" : "Create a goal"}</Text>
        <Text style={styles.body}>
          {locale === "fr"
            ? "L’IA créera des étapes inédites si nécessaire. Rien n’est codé en dur."
            : "AI can create novel steps as needed. Nothing is hard-coded."}
        </Text>
        <View style={{ height: Tokens.space.md }} />

        <View style={styles.row2}>
          <PrimaryButton title="Visa" variant={type === "visa" ? "brand" : "ghost"} onPress={() => setType("visa")} style={{ flex: 1 }} />
          <PrimaryButton title={locale === "fr" ? "Admission" : "Admission"} variant={type === "admission" ? "brand" : "ghost"} onPress={() => setType("admission")} style={{ flex: 1 }} />
          <PrimaryButton title={locale === "fr" ? "Admin" : "Admin"} variant={type === "admin" ? "brand" : "ghost"} onPress={() => setType("admin")} style={{ flex: 1 }} />
        </View>

        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>{locale === "fr" ? "Intention" : "Intent"}</Text>
        <TextInput value={intent} onChangeText={setIntent} style={styles.input} placeholderTextColor="rgba(246,248,255,0.35)" />

        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>{locale === "fr" ? "Pays / zone" : "Country / region"}</Text>
        <TextInput value={country} onChangeText={setCountry} style={styles.input} placeholderTextColor="rgba(246,248,255,0.35)" />

        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>{locale === "fr" ? "Cible (école/ambassade) optionnel" : "Target (school/embassy) optional"}</Text>
        <TextInput value={target} onChangeText={setTarget} style={styles.input} placeholderTextColor="rgba(246,248,255,0.35)" />

        <View style={{ height: Tokens.space.lg }} />
        <PrimaryButton
          title={loading ? "…" : locale === "fr" ? "Démarrer" : "Start"}
          onPress={async () => {
            setLoading(true);
            setError(null);
            try {
              const res = await Api.createJourney({
                locale,
                goal: { type, intent, country, target: target.trim() || null },
                context: buildContext(profile, docs),
              });
              router.push(`/journeys/${res.journey.id}`);
            } catch (e: any) {
              setError(String(e?.message || e));
            } finally {
              setLoading(false);
            }
          }}
          style={{ opacity: profile ? 1 : 0.75 }}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </GlassCard>

      <GlassCard>
        <View style={styles.rowTop}>
          <Text style={styles.cardTitle}>{locale === "fr" ? "Vos parcours" : "Your journeys"}</Text>
          {loading ? <ActivityIndicator /> : null}
        </View>
        <View style={{ height: Tokens.space.sm }} />
        {journeys.length ? (
          journeys.slice(0, 20).map((j) => (
            <View key={j.id} style={styles.procRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.procTitle}>{pickLabel(j.plan?.title, locale) || j.id}</Text>
                <Text style={styles.procMeta}>{j.updated_at}</Text>
              </View>
              <PrimaryButton title={locale === "fr" ? "Ouvrir" : "Open"} variant="ghost" onPress={() => router.push(`/journeys/${j.id}`)} />
            </View>
          ))
        ) : (
          <Text style={styles.body}>{locale === "fr" ? "Aucun parcours pour l’instant." : "No journeys yet."}</Text>
        )}
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { color: Colors.text, fontSize: Tokens.font.size.lg, fontWeight: Tokens.font.weight.bold },
  body: { marginTop: Tokens.space.sm, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  label: { color: Colors.faint, fontSize: Tokens.font.size.sm, fontWeight: Tokens.font.weight.medium },
  input: {
    marginTop: 8,
    borderRadius: Tokens.radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card2,
    paddingHorizontal: Tokens.space.md,
    paddingVertical: Tokens.space.md,
    color: Colors.text,
    fontSize: Tokens.font.size.md,
  },
  row2: { flexDirection: "row", gap: 10, marginTop: 8 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  error: { marginTop: Tokens.space.md, color: Colors.warning, fontSize: Tokens.font.size.md, lineHeight: 22 },
  procRow: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: Tokens.space.md },
  procTitle: { color: Colors.text, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.bold },
  procMeta: { marginTop: 4, color: Colors.faint, fontSize: Tokens.font.size.sm },
});

