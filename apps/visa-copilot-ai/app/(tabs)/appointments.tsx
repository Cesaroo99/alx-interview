import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";

type Reminder = { id: string; title: string; dateIso: string };

export default function AppointmentsScreen() {
  // MVP local (sans serveur): reminders in-memory. Prochaine itération: persistance + notifications programmées.
  const [title, setTitle] = useState("Rendez-vous visa");
  const [dateIso, setDateIso] = useState("2026-01-15");
  const [reminders, setReminders] = useState<Reminder[]>([]);

  const canAdd = useMemo(() => title.trim().length >= 2 && dateIso.trim().length >= 8, [title, dateIso]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Rendez-vous & délais</Text>
        <Text style={styles.subtitle}>MVP: rappels simples. Prochaine étape: notifications push + calendrier intégré.</Text>
      </View>

      <GlassCard>
        <Text style={styles.cardTitle}>Créer un rappel</Text>
        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>Titre</Text>
        <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholderTextColor="rgba(245,247,255,0.35)" />
        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
        <TextInput value={dateIso} onChangeText={setDateIso} style={styles.input} placeholderTextColor="rgba(245,247,255,0.35)" />
        <View style={{ height: Tokens.space.lg }} />
        <PrimaryButton
          title="Ajouter"
          onPress={() => {
            if (!canAdd) return;
            setReminders((r) => [{ id: `r_${Date.now()}`, title: title.trim(), dateIso: dateIso.trim() }, ...r]);
          }}
          style={{ opacity: canAdd ? 1 : 0.6 }}
        />
      </GlassCard>

      {reminders.length ? (
        <GlassCard>
          <Text style={styles.cardTitle}>Vos rappels</Text>
          <View style={{ height: Tokens.space.sm }} />
          {reminders.map((r) => (
            <View key={r.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{r.title}</Text>
                <Text style={styles.rowSub}>{r.dateIso}</Text>
              </View>
              <PrimaryButton title="Suppr." variant="ghost" onPress={() => setReminders((x) => x.filter((y) => y.id !== r.id))} />
            </View>
          ))}
        </GlassCard>
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
  rowTitle: { color: Colors.text, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.bold },
  rowSub: { color: Colors.faint, fontSize: Tokens.font.size.sm, marginTop: 4 },
});

