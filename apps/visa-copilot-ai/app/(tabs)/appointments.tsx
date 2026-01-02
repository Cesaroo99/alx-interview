import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { AnimatedIn } from "@/src/ui/AnimatedIn";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";
import { useInsights } from "@/src/state/insights";
import { useVisaTimeline } from "@/src/state/visa_timeline";

export default function AppointmentsScreen() {
  const { insights } = useInsights();
  const { state, upsertVisa, addManualEvent, editEventDate, markEventCompleted, deleteEvent } = useVisaTimeline();

  const [title, setTitle] = useState("Rappel visa");
  const [dateIso, setDateIso] = useState("");
  const [category, setCategory] = useState<"appointment" | "deadline" | "payment" | "other">("appointment");
  const [notes, setNotes] = useState("");

  const canAdd = useMemo(() => title.trim().length >= 2 && dateIso.trim().length >= 8, [title, dateIso]);

  const activeVisaHint = useMemo(() => {
    const d = insights?.lastDossier;
    return {
      country: String(d?.destination_region || "unknown"),
      visaType: String(d?.visa_type || "unknown"),
      objective: "visa",
      stage: "appointment",
    };
  }, [insights]);

  const upcoming = useMemo(() => {
    const t = new Date();
    const iso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    const events = (state.events || []).filter((e) => e.status !== "deleted");
    const dated = events
      .map((e) => ({ e, d: e.dateIso || e.startDateIso }))
      .filter((x) => !!x.d)
      .sort((a, b) => String(a.d).localeCompare(String(b.d)));
    const next = dated.find((x) => String(x.d) >= iso);
    return { today: iso, next: next?.e || null };
  }, [state.events]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Timeline & rappels</Text>
        <Text style={styles.subtitle}>
          Assistant silencieux: détecte des dates (WebView), propose de les enregistrer, puis crée automatiquement des rappels (J‑14/J‑7/J‑3/J‑1/J‑0).
        </Text>
      </View>

      <AnimatedIn delayMs={0}>
        <GlassCard>
          <Text style={styles.cardTitle}>A. Current focus</Text>
          <Text style={styles.body}>
            Prochaine date: {upcoming.next ? `${upcoming.next.title} · ${(upcoming.next.dateIso || upcoming.next.startDateIso) ?? "—"}` : "—"}
          </Text>
          <View style={{ height: Tokens.space.md }} />
          <View style={styles.row2}>
            <PrimaryButton
              title="Ouvrir un portail (manuel)"
              variant="ghost"
              onPress={() =>
                router.push({
                  pathname: "/portal",
                  params: {
                    url: "https://",
                    country: activeVisaHint.country,
                    visa_type: activeVisaHint.visaType,
                    stage: activeVisaHint.stage,
                    objective: activeVisaHint.objective,
                  },
                })
              }
              style={{ flex: 1 }}
            />
          </View>
        </GlassCard>
      </AnimatedIn>

      <AnimatedIn delayMs={80}>
        <GlassCard>
          <Text style={styles.cardTitle}>B. Ajouter un rappel manuel</Text>
          <View style={{ height: Tokens.space.md }} />
          <Text style={styles.label}>Titre</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            style={styles.input}
            placeholderTextColor="rgba(16,22,47,0.35)"
          />
          <View style={{ height: Tokens.space.md }} />
          <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
          <TextInput
            value={dateIso}
            onChangeText={setDateIso}
            style={styles.input}
            placeholderTextColor="rgba(16,22,47,0.35)"
          />
          <View style={{ height: Tokens.space.md }} />
          <Text style={styles.label}>Catégorie</Text>
          <View style={styles.row2}>
            <PrimaryButton
              title="Rendez-vous"
              variant={category === "appointment" ? "brand" : "ghost"}
              onPress={() => setCategory("appointment")}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              title="Deadline"
              variant={category === "deadline" ? "brand" : "ghost"}
              onPress={() => setCategory("deadline")}
              style={{ flex: 1 }}
            />
          </View>
          <View style={{ height: Tokens.space.sm }} />
          <View style={styles.row2}>
            <PrimaryButton
              title="Paiement"
              variant={category === "payment" ? "brand" : "ghost"}
              onPress={() => setCategory("payment")}
              style={{ flex: 1 }}
            />
            <PrimaryButton title="Autre" variant={category === "other" ? "brand" : "ghost"} onPress={() => setCategory("other")} style={{ flex: 1 }} />
          </View>
          <View style={{ height: Tokens.space.md }} />
          <Text style={styles.label}>Notes (optionnel)</Text>
          <TextInput value={notes} onChangeText={setNotes} style={styles.input} placeholderTextColor="rgba(16,22,47,0.35)" />
          <View style={{ height: Tokens.space.lg }} />
          <PrimaryButton
            title="Ajouter"
            onPress={async () => {
              if (!canAdd) return;
              const visaId = await upsertVisa(activeVisaHint);
              await addManualEvent({
                visaId,
                title: title.trim(),
                type: category as any,
                dateIso: dateIso.trim(),
                notes: notes.trim() || undefined,
              });
              setNotes("");
            }}
            style={{ opacity: canAdd ? 1 : 0.6 }}
          />
        </GlassCard>
      </AnimatedIn>

      {state.events.length ? (
        <AnimatedIn delayMs={120}>
          <GlassCard>
            <Text style={styles.cardTitle}>C. Visa timeline</Text>
            <View style={{ height: Tokens.space.sm }} />
            {state.events
              .slice()
              .sort((a, b) => String(a.dateIso || a.startDateIso || "9999").localeCompare(String(b.dateIso || b.startDateIso || "9999")))
              .map((e) => (
              <View key={e.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{e.title}</Text>
                  <Text style={styles.rowSub}>
                    {(e.dateIso || e.startDateIso || "—")} · statut: {e.status} · rappels: {(e.reminders || []).map((x) => `J-${x.offsetDays}`).sort().join(", ")}
                  </Text>
                </View>
                <View style={{ gap: 8 }}>
                  <PrimaryButton title="Terminé" variant="ghost" onPress={() => markEventCompleted(e.id)} />
                  <PrimaryButton
                    title="Éditer"
                    variant="ghost"
                    onPress={() => editEventDate(e.id, { dateIso: e.dateIso || e.startDateIso || "" })}
                  />
                  <PrimaryButton title="Suppr." variant="ghost" onPress={() => deleteEvent(e.id)} />
                </View>
              </View>
            ))}
          </GlassCard>
        </AnimatedIn>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 8 },
  title: { color: Colors.text, fontSize: Tokens.font.size.xxl, fontWeight: Tokens.font.weight.black },
  subtitle: { color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  cardTitle: { color: Colors.text, fontSize: Tokens.font.size.lg, fontWeight: Tokens.font.weight.bold },
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
  body: { marginTop: Tokens.space.sm, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  row: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: Tokens.space.md },
  row2: { flexDirection: "row", gap: 10, marginTop: 8 },
  rowTitle: { color: Colors.text, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.bold },
  rowSub: { color: Colors.faint, fontSize: Tokens.font.size.sm, marginTop: 4 },
});

