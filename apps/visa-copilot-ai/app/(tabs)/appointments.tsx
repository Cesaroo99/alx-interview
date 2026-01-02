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

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AppointmentsScreen() {
  const { insights } = useInsights();
  const { state, setSilentMode, upsertVisa, addManualEvent, resolvePendingDetection, editEventDate, markEventCompleted, deleteEvent } = useVisaTimeline();

  const [title, setTitle] = useState("Rappel visa");
  const [dateIso, setDateIso] = useState("");
  const [category, setCategory] = useState<"appointment" | "deadline" | "payment" | "other">("appointment");
  const [notes, setNotes] = useState("");

  const [editOpen, setEditOpen] = useState<{ id: string; dateIso: string } | null>(null);
  const [editValue, setEditValue] = useState("");

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
    const iso = todayIso();
    const events = (state.events || []).filter((e) => e.status !== "deleted");
    const dated = events
      .map((e) => ({ e, d: e.dateIso || e.startDateIso }))
      .filter((x) => !!x.d)
      .sort((a, b) => String(a.d).localeCompare(String(b.d)));
    const next = dated.find((x) => String(x.d) >= iso);
    return { today: iso, next: next?.e || null };
  }, [state.events]);

  const reminderCenter = useMemo(() => {
    const iso = todayIso();
    const inDays = (dIso: string) => {
      const d = new Date(dIso + "T09:00:00");
      const now = new Date(iso + "T09:00:00");
      return Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    };
    const upcomingEvents = (state.events || [])
      .filter((e) => e.status !== "completed")
      .map((e) => ({ e, d: e.dateIso || e.startDateIso }))
      .filter((x) => !!x.d)
      .map((x) => ({ e: x.e, d: String(x.d), days: inDays(String(x.d)) }))
      .sort((a, b) => a.d.localeCompare(b.d));

    const overdue = upcomingEvents.filter((x) => x.days < 0);
    const next7 = upcomingEvents.filter((x) => x.days >= 0 && x.days <= 7);
    const next30 = upcomingEvents.filter((x) => x.days >= 0 && x.days <= 30);
    return { overdue, next7, next30 };
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
          <Text style={styles.body}>Détections en attente: {state.pending?.length || 0}</Text>
          <View style={{ height: Tokens.space.md }} />
          <View style={styles.row2}>
            <PrimaryButton
              title={state.settings?.silentMode !== false ? "Mode silencieux: ON" : "Mode silencieux: OFF"}
              variant="ghost"
              onPress={() => setSilentMode(!(state.settings?.silentMode !== false))}
              style={{ flex: 1 }}
            />
          </View>
          <View style={{ height: Tokens.space.sm }} />
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

      {state.pending?.length ? (
        <AnimatedIn delayMs={60}>
          <GlassCard>
            <Text style={styles.cardTitle}>B. Dates détectées (à confirmer)</Text>
            <Text style={styles.body}>Silent by default: confirme ici avant de créer les rappels.</Text>
            {state.pending.slice(0, 5).map((p) => (
              <View key={p.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{p.title}</Text>
                  <Text style={styles.rowSub}>{p.dateIso || p.startDateIso || "—"} · {p.sourceUrl ? "source: page" : ""}</Text>
                </View>
                <View style={{ gap: 8 }}>
                  <PrimaryButton title="Sauver" onPress={() => resolvePendingDetection(p.id, "save")} />
                  <PrimaryButton
                    title="Éditer"
                    variant="ghost"
                    onPress={() => {
                      setEditOpen({ id: p.id, dateIso: p.dateIso || p.startDateIso || "" });
                      setEditValue(p.dateIso || p.startDateIso || "");
                    }}
                  />
                  <PrimaryButton title="Ignorer" variant="ghost" onPress={() => resolvePendingDetection(p.id, "ignore")} />
                </View>
              </View>
            ))}
          </GlassCard>
        </AnimatedIn>
      ) : null}

      <AnimatedIn delayMs={80}>
        <GlassCard>
          <Text style={styles.cardTitle}>C. Ajouter un rappel manuel</Text>
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

      <AnimatedIn delayMs={100}>
        <GlassCard>
          <Text style={styles.cardTitle}>D. Reminder center</Text>
          <Text style={styles.body}>Prochains 7 jours / 30 jours / en retard.</Text>
          <View style={{ height: Tokens.space.sm }} />
          <Text style={styles.smallTitle}>Next 7 days</Text>
          {(reminderCenter.next7 || []).slice(0, 6).map((x) => (
            <Text key={x.e.id} style={styles.rowSub}>
              {x.d} · {x.e.title}
            </Text>
          ))}
          <View style={{ height: Tokens.space.sm }} />
          <Text style={styles.smallTitle}>Next 30 days</Text>
          {(reminderCenter.next30 || []).slice(0, 6).map((x) => (
            <Text key={x.e.id} style={styles.rowSub}>
              {x.d} · {x.e.title}
            </Text>
          ))}
          <View style={{ height: Tokens.space.sm }} />
          <Text style={styles.smallTitle}>Overdue</Text>
          {(reminderCenter.overdue || []).slice(0, 6).map((x) => (
            <Text key={x.e.id} style={[styles.rowSub, { color: Colors.danger }]}>
              {x.d} · {x.e.title}
            </Text>
          ))}
        </GlassCard>
      </AnimatedIn>

      {state.events.length ? (
        <AnimatedIn delayMs={120}>
          <GlassCard>
            <Text style={styles.cardTitle}>E. Visa timeline</Text>
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
                    onPress={() => {
                      setEditOpen({ id: e.id, dateIso: e.dateIso || e.startDateIso || "" });
                      setEditValue(e.dateIso || e.startDateIso || "");
                    }}
                  />
                  <PrimaryButton title="Suppr." variant="ghost" onPress={() => deleteEvent(e.id)} />
                </View>
              </View>
            ))}
          </GlassCard>
        </AnimatedIn>
      ) : null}

      {editOpen ? (
        <View style={styles.overlay}>
          <GlassCard>
            <Text style={styles.cardTitle}>Éditer la date</Text>
            <Text style={styles.body}>Format: YYYY-MM-DD</Text>
            <TextInput value={editValue} onChangeText={setEditValue} style={styles.input} placeholderTextColor="rgba(16,22,47,0.35)" />
            <View style={{ height: Tokens.space.md }} />
            <View style={styles.row2}>
              <PrimaryButton title="Annuler" variant="ghost" onPress={() => setEditOpen(null)} style={{ flex: 1 }} />
              <PrimaryButton
                title="Enregistrer"
                onPress={async () => {
                  // If edit is for pending, use resolvePendingDetection(edit)
                  const isPending = (state.pending || []).some((p) => p.id === editOpen.id);
                  if (isPending) await resolvePendingDetection(editOpen.id, "edit", { dateIso: editValue.trim() || undefined });
                  else await editEventDate(editOpen.id, { dateIso: editValue.trim() || undefined });
                  setEditOpen(null);
                }}
                style={{ flex: 1 }}
              />
            </View>
          </GlassCard>
        </View>
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
  smallTitle: { marginTop: Tokens.space.md, color: Colors.text, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.bold },
  row: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: Tokens.space.md },
  row2: { flexDirection: "row", gap: 10, marginTop: 8 },
  rowTitle: { color: Colors.text, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.bold },
  rowSub: { color: Colors.faint, fontSize: Tokens.font.size.sm, marginTop: 4 },
  overlay: { position: "absolute", left: 0, right: 0, bottom: 0, padding: Tokens.space.xl },
});

