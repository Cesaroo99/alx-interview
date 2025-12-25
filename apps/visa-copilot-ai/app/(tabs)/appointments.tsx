import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { AnimatedIn } from "@/src/ui/AnimatedIn";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";
import { useReminders } from "@/src/state/reminders";

export default function AppointmentsScreen() {
  const [title, setTitle] = useState("Rendez-vous visa");
  const [dateIso, setDateIso] = useState("2026-01-15");
  const [mode, setMode] = useState<"standard" | "urgent">("standard");
  const { reminders, addReminder, removeReminder } = useReminders();

  const canAdd = useMemo(() => title.trim().length >= 2 && dateIso.trim().length >= 8, [title, dateIso]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Rendez-vous & délais</Text>
        <Text style={styles.subtitle}>Rappels persistés + notifications locales (J-7/J-1/J-0 par défaut).</Text>
      </View>

      <AnimatedIn delayMs={0}>
        <GlassCard>
          <Text style={styles.cardTitle}>Créer un rappel</Text>
          <View style={{ height: Tokens.space.md }} />
          <Text style={styles.label}>Titre</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            style={styles.input}
            placeholderTextColor="rgba(245,247,255,0.35)"
          />
          <View style={{ height: Tokens.space.md }} />
          <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
          <TextInput
            value={dateIso}
            onChangeText={setDateIso}
            style={styles.input}
            placeholderTextColor="rgba(245,247,255,0.35)"
          />
          <View style={{ height: Tokens.space.md }} />
          <Text style={styles.label}>Mode</Text>
          <View style={styles.row2}>
            <PrimaryButton
              title="Standard (J-7/J-1/J-0)"
              variant={mode === "standard" ? "brand" : "ghost"}
              onPress={() => setMode("standard")}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              title="Urgent (J-1/J-0)"
              variant={mode === "urgent" ? "brand" : "ghost"}
              onPress={() => setMode("urgent")}
              style={{ flex: 1 }}
            />
          </View>
          <View style={{ height: Tokens.space.lg }} />
          <PrimaryButton
            title="Ajouter"
            onPress={async () => {
              if (!canAdd) return;
              await addReminder({
                title: title.trim(),
                dateIso: dateIso.trim(),
                offsetsDays: mode === "urgent" ? [1, 0] : [7, 1, 0],
              });
            }}
            style={{ opacity: canAdd ? 1 : 0.6 }}
          />
        </GlassCard>
      </AnimatedIn>

      {reminders.length ? (
        <AnimatedIn delayMs={120}>
          <GlassCard>
            <Text style={styles.cardTitle}>Vos rappels</Text>
            <View style={{ height: Tokens.space.sm }} />
            {reminders.map((r) => (
              <View key={r.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{r.title}</Text>
                  <Text style={styles.rowSub}>
                    {r.dateIso} · rappels: {(r.offsetsDays || [7, 1, 0]).sort((a, b) => b - a).map((d) => `J-${d}`).join(", ")}
                  </Text>
                </View>
                <PrimaryButton title="Suppr." variant="ghost" onPress={() => removeReminder(r.id)} />
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
  row: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: Tokens.space.md },
  row2: { flexDirection: "row", gap: 10, marginTop: 8 },
  rowTitle: { color: Colors.text, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.bold },
  rowSub: { color: Colors.faint, fontSize: Tokens.font.size.sm, marginTop: 4 },
});

