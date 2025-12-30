import React, { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { Api, type TravelPlanResponse } from "@/src/api/client";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { ActionButton } from "@/src/ui/ActionButton";
import { Screen } from "@/src/ui/Screen";
import { useProfile } from "@/src/state/profile";

function parseNumberOrNull(s: string): number | null {
  const raw = s.trim().replace(",", ".");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export default function TravelIntelligenceScreen() {
  const { profile } = useProfile();

  const [destination, setDestination] = useState(profile?.destination_region_hint || "Paris, France");
  const [startDate, setStartDate] = useState("2026-02-10");
  const [endDate, setEndDate] = useState("2026-02-18");
  const [budgetUsd, setBudgetUsd] = useState("1400");
  const [anchorCity, setAnchorCity] = useState("");
  const [mode, setMode] = useState<"simulation" | "post_visa_booking">("simulation");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TravelPlanResponse | null>(null);

  const durationHint = useMemo(() => {
    // Approximatif (sans parser dates), juste pour UX.
    if (!startDate.trim() || !endDate.trim()) return null;
    if (endDate.trim() < startDate.trim()) return "La date de fin doit être >= début.";
    return null;
  }, [startDate, endDate]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Travel Intelligence</Text>
        <Text style={styles.subtitle}>
          Un itinéraire “visa‑compliant” en mode simulation: cohérence durée/budget/motif, sans réservations ni paiement.
        </Text>
      </View>

      {!profile ? (
        <GlassCard>
          <Text style={styles.cardTitle}>Profil requis</Text>
          <Text style={styles.body}>
            Pour générer un itinéraire crédible, on a besoin au minimum de ton profil (motif, situation, etc.).
          </Text>
          <View style={{ height: Tokens.space.md }} />
          <ActionButton title="Faire l’onboarding" onPress={() => router.push("/onboarding")} track={{ type: "nav", label: "open_onboarding", screen: "tools.travel" }} />
        </GlassCard>
      ) : null}

      <GlassCard>
        <Text style={styles.cardTitle}>Paramètres</Text>
        <View style={{ height: Tokens.space.md }} />

        <Text style={styles.label}>Destination</Text>
        <TextInput
          value={destination}
          onChangeText={setDestination}
          placeholder="Ex: Paris, France"
          placeholderTextColor="rgba(245,247,255,0.35)"
          style={styles.input}
        />

        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>Dates (YYYY-MM-DD)</Text>
        <View style={styles.row2}>
          <TextInput
            value={startDate}
            onChangeText={setStartDate}
            placeholder="Début"
            placeholderTextColor="rgba(245,247,255,0.35)"
            style={[styles.input, { flex: 1 }]}
          />
          <TextInput
            value={endDate}
            onChangeText={setEndDate}
            placeholder="Fin"
            placeholderTextColor="rgba(245,247,255,0.35)"
            style={[styles.input, { flex: 1 }]}
          />
        </View>
        {durationHint ? <Text style={styles.warn}>{durationHint}</Text> : null}

        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>Budget total estimé (USD)</Text>
        <TextInput
          value={budgetUsd}
          onChangeText={setBudgetUsd}
          placeholder="Ex: 1400"
          placeholderTextColor="rgba(245,247,255,0.35)"
          keyboardType="numeric"
          style={styles.input}
        />

        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>Ville d’ancrage (optionnel)</Text>
        <TextInput
          value={anchorCity}
          onChangeText={setAnchorCity}
          placeholder="Ex: Paris"
          placeholderTextColor="rgba(245,247,255,0.35)"
          style={styles.input}
        />

        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>Mode</Text>
        <View style={styles.row2}>
          <ActionButton
            title="Simulation (recommandé)"
            variant={mode === "simulation" ? "brand" : "ghost"}
            onPress={() => setMode("simulation")}
            style={{ flex: 1 }}
            track={{ type: "select", label: "mode_simulation", screen: "tools.travel" }}
          />
          <ActionButton
            title="Post‑visa (réservations)"
            variant={mode === "post_visa_booking" ? "brand" : "ghost"}
            onPress={() => setMode("post_visa_booking")}
            style={{ flex: 1 }}
            track={{ type: "select", label: "mode_post_visa", screen: "tools.travel" }}
          />
        </View>

        <View style={{ height: Tokens.space.lg }} />
        <ActionButton
          title={loading ? "Génération…" : "Générer un itinéraire"}
          onPress={async () => {
            if (!profile) return;
            const budget = parseNumberOrNull(budgetUsd);
            if (!budget || budget <= 0) {
              setError("Budget invalide (ex: 1400).");
              return;
            }
            setLoading(true);
            setError(null);
            try {
              const res = await Api.planTrip({
                profile,
                destination,
                start_date: startDate,
                end_date: endDate,
                estimated_budget_usd: budget,
                mode,
                anchor_city: anchorCity.trim() || undefined,
              });
              setResult(res);
            } catch (e: any) {
              setError(String(e?.message || e));
              setResult(null);
            } finally {
              setLoading(false);
            }
          }}
          style={{ opacity: profile ? 1 : 0.6 }}
          track={{ type: "tool", label: "generate_itinerary", screen: "tools.travel", meta: { destination, startDate, endDate, mode } }}
        />
      </GlassCard>

      {loading ? (
        <GlassCard>
          <View style={styles.loadingRow}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Construction d’un itinéraire cohérent…</Text>
          </View>
        </GlassCard>
      ) : error ? (
        <GlassCard>
          <Text style={styles.error}>{error}</Text>
          <Text style={styles.body}>Astuce: vérifie que l’API est joignable (variable `EXPO_PUBLIC_API_BASE_URL`).</Text>
        </GlassCard>
      ) : result ? (
        <>
          <GlassCard>
            <Text style={styles.cardTitle}>Résumé</Text>
            <View style={{ height: Tokens.space.sm }} />
            <View style={styles.kv}>
              <Text style={styles.k}>Durée</Text>
              <Text style={styles.v}>{result.duration_days} jours</Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.k}>Budget</Text>
              <Text style={styles.v}>{Math.round(result.estimated_budget_usd)} USD · {result.budget_level}</Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.k}>Mode</Text>
              <Text style={styles.v}>{result.mode}</Text>
            </View>
          </GlassCard>

          {result.coherence_warnings?.length ? (
            <GlassCard>
              <Text style={styles.cardTitle}>Alertes de cohérence</Text>
              <View style={{ height: Tokens.space.sm }} />
              {result.coherence_warnings.map((w) => (
                <View key={w} style={styles.bulletRow}>
                  <View style={[styles.dot, { backgroundColor: Colors.warning }]} />
                  <Text style={styles.text}>{w}</Text>
                </View>
              ))}
            </GlassCard>
          ) : null}

          {result.why?.length ? (
            <GlassCard>
              <Text style={styles.cardTitle}>Pourquoi ça compte</Text>
              <View style={{ height: Tokens.space.sm }} />
              {result.why.map((w) => (
                <View key={w} style={styles.bulletRow}>
                  <View style={[styles.dot, { backgroundColor: Colors.brandB }]} />
                  <Text style={styles.text}>{w}</Text>
                </View>
              ))}
            </GlassCard>
          ) : null}

          <GlassCard>
            <Text style={styles.cardTitle}>Itinéraire</Text>
            <View style={{ height: Tokens.space.sm }} />
            {result.itinerary.slice(0, 12).map((d) => (
              <View key={`${d.day}-${d.date}-${d.city}`} style={styles.dayRow}>
                <Text style={styles.dayTitle}>
                  Jour {d.day} — {d.city} ({d.date})
                </Text>
                {d.activities.map((a) => (
                  <View key={a} style={styles.bulletRow}>
                    <View style={[styles.dot, { backgroundColor: Colors.faint }]} />
                    <Text style={styles.text}>{a}</Text>
                  </View>
                ))}
                <Text style={styles.note}>{d.accommodation_note}</Text>
                <View style={{ height: Tokens.space.sm }} />
              </View>
            ))}
            {result.itinerary.length > 12 ? <Text style={styles.body}>…itinéraire tronqué (12 premiers jours).</Text> : null}
          </GlassCard>

          <GlassCard>
            <Text style={styles.cardTitle}>Politique de réservation</Text>
            <View style={{ height: Tokens.space.sm }} />
            {result.booking_policy.map((p) => (
              <View key={p} style={styles.bulletRow}>
                <View style={[styles.dot, { backgroundColor: Colors.brandB }]} />
                <Text style={styles.text}>{p}</Text>
              </View>
            ))}
          </GlassCard>

          <GlassCard>
            <Text style={styles.cardTitle}>Notes</Text>
            <View style={{ height: Tokens.space.sm }} />
            {result.disclaimers.map((p) => (
              <View key={p} style={styles.bulletRow}>
                <View style={[styles.dot, { backgroundColor: Colors.faint }]} />
                <Text style={styles.text}>{p}</Text>
              </View>
            ))}
          </GlassCard>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 8 },
  title: { color: Colors.text, fontSize: Tokens.font.size.xxl, fontWeight: Tokens.font.weight.black },
  subtitle: { color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
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
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  loadingText: { color: Colors.muted, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.medium },
  error: { color: Colors.warning, fontSize: Tokens.font.size.md, lineHeight: 22 },
  warn: { marginTop: 8, color: Colors.warning, fontSize: Tokens.font.size.sm, lineHeight: 20 },
  kv: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  k: { color: Colors.faint, fontSize: Tokens.font.size.sm, width: 120 },
  v: { color: Colors.text, fontSize: Tokens.font.size.sm, fontWeight: Tokens.font.weight.semibold, flex: 1 },
  bulletRow: { flexDirection: "row", gap: 10, marginTop: Tokens.space.sm, alignItems: "flex-start" },
  dot: { width: 10, height: 10, borderRadius: 99, marginTop: 6 },
  text: { flex: 1, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  dayRow: { marginTop: Tokens.space.sm },
  dayTitle: { color: Colors.text, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.bold },
  note: { marginTop: Tokens.space.sm, color: Colors.faint, fontSize: Tokens.font.size.sm, lineHeight: 20 },
});

