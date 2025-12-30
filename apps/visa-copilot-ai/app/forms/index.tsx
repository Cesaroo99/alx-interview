import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { Api, type Procedure } from "@/src/api/client";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { HeroBanner } from "@/src/ui/HeroBanner";
import { ActionButton } from "@/src/ui/ActionButton";
import { Screen } from "@/src/ui/Screen";

type ProcType = "visa" | "admission" | "admin";

export default function FormsHome() {
  const [locale, setLocale] = useState<"fr" | "en">("fr");
  const [type, setType] = useState<ProcType>("visa");
  const [intent, setIntent] = useState("tourism");
  const [country, setCountry] = useState("schengen");
  const [region, setRegion] = useState("");
  const [target, setTarget] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Procedure[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await Api.listProcedures();
        if (!cancelled) setItems(res.items || []);
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

  const canCreate = useMemo(() => !!type && !!intent && !!country, [type, intent, country]);

  return (
    <Screen>
      <HeroBanner
        kicker={locale === "fr" ? "Guidé" : "Guided"}
        title={locale === "fr" ? "Formulaires & démarches" : "Forms & procedures"}
        subtitle={
          locale === "fr"
            ? "Choisissez une démarche, suivez les étapes, obtenez des suggestions IA par champ (sans auto‑remplissage)."
            : "Pick a procedure, follow steps, get AI field suggestions (no auto‑filling)."
        }
      />

      <GlassCard>
        <Text style={styles.cardTitle}>{locale === "fr" ? "Langue" : "Language"}</Text>
        <View style={{ height: Tokens.space.sm }} />
        <View style={styles.row2}>
          <ActionButton title="FR" variant={locale === "fr" ? "brand" : "ghost"} onPress={() => setLocale("fr")} style={{ flex: 1 }} track={{ type: "pref", label: "set_locale_fr", screen: "forms.home" }} />
          <ActionButton title="EN" variant={locale === "en" ? "brand" : "ghost"} onPress={() => setLocale("en")} style={{ flex: 1 }} track={{ type: "pref", label: "set_locale_en", screen: "forms.home" }} />
        </View>
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>{locale === "fr" ? "Nouvelle démarche" : "New procedure"}</Text>
        <Text style={styles.body}>
          {locale === "fr"
            ? "MVP: le backend sélectionne automatiquement un formulaire guide depuis le catalogue."
            : "MVP: backend auto-selects a guide form from the catalog."}
        </Text>
        <View style={{ height: Tokens.space.md }} />

        <Text style={styles.label}>{locale === "fr" ? "Type" : "Type"}</Text>
        <View style={styles.row2}>
          <ActionButton title="Visa" variant={type === "visa" ? "brand" : "ghost"} onPress={() => setType("visa")} style={{ flex: 1 }} track={{ type: "select", label: "proc_type_visa", screen: "forms.home" }} />
          <ActionButton title={locale === "fr" ? "Admission" : "Admission"} variant={type === "admission" ? "brand" : "ghost"} onPress={() => setType("admission")} style={{ flex: 1 }} track={{ type: "select", label: "proc_type_admission", screen: "forms.home" }} />
          <ActionButton title={locale === "fr" ? "Admin" : "Admin"} variant={type === "admin" ? "brand" : "ghost"} onPress={() => setType("admin")} style={{ flex: 1 }} track={{ type: "select", label: "proc_type_admin", screen: "forms.home" }} />
        </View>

        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>{locale === "fr" ? "Intention" : "Intent"}</Text>
        <TextInput value={intent} onChangeText={setIntent} style={styles.input} placeholderTextColor="rgba(246,248,255,0.35)" />

        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>{locale === "fr" ? "Pays / zone" : "Country / region"}</Text>
        <TextInput value={country} onChangeText={setCountry} style={styles.input} placeholderTextColor="rgba(246,248,255,0.35)" />

        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>{locale === "fr" ? "Région (optionnel)" : "Region (optional)"}</Text>
        <TextInput value={region} onChangeText={setRegion} style={styles.input} placeholderTextColor="rgba(246,248,255,0.35)" />

        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>{locale === "fr" ? "École / ambassade / service (optionnel)" : "School/embassy/service (optional)"}</Text>
        <TextInput value={target} onChangeText={setTarget} style={styles.input} placeholderTextColor="rgba(246,248,255,0.35)" />

        <View style={{ height: Tokens.space.lg }} />
        <ActionButton
          title={loading ? "…" : locale === "fr" ? "Créer la démarche" : "Create procedure"}
          onPress={async () => {
            if (!canCreate || loading) return;
            setLoading(true);
            setError(null);
            try {
              const res = await Api.createProcedure({
                type,
                intent,
                country,
                region: region.trim() || undefined,
                target: target.trim() || undefined,
                locale,
              });
              router.push(`/forms/${res.procedure.id}`);
            } catch (e: any) {
              setError(String(e?.message || e));
            } finally {
              setLoading(false);
            }
          }}
          style={{ opacity: canCreate ? 1 : 0.6 }}
          track={{ type: "forms", label: "create_procedure", screen: "forms.home", meta: { type, intent, country } }}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </GlassCard>

      <GlassCard>
        <View style={styles.rowTop}>
          <Text style={styles.cardTitle}>{locale === "fr" ? "Vos démarches" : "Your procedures"}</Text>
          {loading ? <ActivityIndicator /> : null}
        </View>
        <View style={{ height: Tokens.space.sm }} />
        {items.length ? (
          items.slice(0, 20).map((p) => (
            <View key={p.id} style={styles.procRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.procTitle}>
                  {p.type} · {p.country} · {p.intent}
                </Text>
                <Text style={styles.procMeta}>
                  {p.status} · {p.updated_at}
                </Text>
              </View>
              <ActionButton title={locale === "fr" ? "Ouvrir" : "Open"} variant="ghost" onPress={() => router.push(`/forms/${p.id}`)} track={{ type: "nav", label: "open_procedure", screen: "forms.home", target: p.id }} />
            </View>
          ))
        ) : (
          <Text style={styles.body}>{locale === "fr" ? "Aucune démarche pour l’instant." : "No procedures yet."}</Text>
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

