import React, { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { Api, type TravelPlanResponse } from "@/src/api/client";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";
import { useProfile } from "@/src/state/profile";
import { useInsights } from "@/src/state/insights";
import { useVisaTimeline } from "@/src/state/visa_timeline";

function parseNumberOrNull(s: string): number | null {
  const raw = s.trim().replace(",", ".");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export default function TravelIntelligenceScreen() {
  const { profile, setProfile } = useProfile();
  const { insights } = useInsights();
  const { state: timelineState, upsertVisa, addManualEvent } = useVisaTimeline();

  const [residence, setResidence] = useState(String(profile?.country_of_residence || ""));
  const [destination, setDestination] = useState(profile?.destination_region_hint || "Paris, France");
  const [startDate, setStartDate] = useState("2026-02-10");
  const [endDate, setEndDate] = useState("2026-02-18");
  const [budgetUsd, setBudgetUsd] = useState("1400");
  const [anchorCity, setAnchorCity] = useState("");
  const [mode, setMode] = useState<"simulation" | "post_visa_booking">("simulation");
  const [alertFilter, setAlertFilter] = useState<"all" | "high">("all");
  const [maximizeCompliance, setMaximizeCompliance] = useState(false);
  const [hideLowAlerts, setHideLowAlerts] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TravelPlanResponse | null>(null);

  const durationHint = useMemo(() => {
    // Approximatif (sans parser dates), juste pour UX.
    if (!startDate.trim() || !endDate.trim()) return null;
    if (endDate.trim() < startDate.trim()) return "La date de fin doit être >= début.";
    return null;
  }, [startDate, endDate]);

  const localOverlapAlerts = useMemo(() => {
    const s = startDate.trim();
    const e = endDate.trim();
    if (!s || !e || e < s) return [];
    const events = (timelineState.events || [])
      .map((ev) => ({ ev, d: ev.dateIso || ev.startDateIso }))
      .filter((x) => !!x.d)
      .filter((x) => String(x.d) >= s && String(x.d) <= e);
    if (!events.length) return [];
    return [
      {
        alert_type: "overlap_with_existing_obligation",
        description: `Chevauchement détecté avec ${events.length} événement(s) déjà dans votre timeline.`,
        risk_level: "Medium",
        suggested_action: "Ajuster les dates ou marquer l’évènement comme résolu si ce n’est plus applicable.",
      },
    ];
  }, [endDate, startDate, timelineState.events]);

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
          <PrimaryButton title="Faire l’onboarding" onPress={() => router.push("/onboarding")} />
        </GlassCard>
      ) : null}

      {profile && !residence.trim() ? (
        <GlassCard>
          <Text style={styles.cardTitle}>Pays de résidence requis</Text>
          <Text style={styles.body}>
            Pour un itinéraire “visa‑compliant”, on a besoin de votre pays de résidence (utilisé pour la cohérence départ/retour).
          </Text>
          <View style={{ height: Tokens.space.md }} />
          <Text style={styles.label}>Pays de résidence</Text>
          <TextInput
            value={residence}
            onChangeText={setResidence}
            placeholder="Ex: Maroc"
            placeholderTextColor="rgba(16,22,47,0.35)"
            style={styles.input}
          />
          <View style={{ height: Tokens.space.md }} />
          <PrimaryButton
            title="Enregistrer"
            onPress={async () => {
              if (!profile) return;
              if (residence.trim().length < 2) return;
              await setProfile({ ...profile, country_of_residence: residence.trim() });
            }}
            style={{ opacity: residence.trim().length >= 2 ? 1 : 0.6 }}
          />
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
          <PrimaryButton
            title="Simulation (recommandé)"
            variant={mode === "simulation" ? "brand" : "ghost"}
            onPress={() => setMode("simulation")}
            style={{ flex: 1 }}
          />
          <PrimaryButton
            title="Post‑visa (réservations)"
            variant={mode === "post_visa_booking" ? "brand" : "ghost"}
            onPress={() => setMode("post_visa_booking")}
            style={{ flex: 1 }}
          />
        </View>

        <View style={{ height: Tokens.space.lg }} />
        <PrimaryButton
          title={loading ? "Génération…" : "Générer un itinéraire"}
          onPress={async () => {
            if (!profile) return;
            if (!String(profile.country_of_residence || residence || "").trim()) {
              setError("Pays de résidence manquant (à renseigner une fois).");
              return;
            }
            const budget = parseNumberOrNull(budgetUsd);
            if (!budget || budget <= 0) {
              setError("Budget invalide (ex: 1400).");
              return;
            }
            setLoading(true);
            setError(null);
            try {
              const visaType = insights?.lastDossier?.visa_type || "unknown";
              if (!profile.country_of_residence && residence.trim().length >= 2) {
                await setProfile({ ...profile, country_of_residence: residence.trim() });
              }
              const res = await Api.planTrip({
                profile,
                destination,
                start_date: startDate,
                end_date: endDate,
                estimated_budget_usd: budget,
                mode,
                anchor_city: anchorCity.trim() || undefined,
                visa_type: visaType,
                maximize_compliance: maximizeCompliance,
              });
              setResult(res);
            } catch (e: any) {
              setError(String(e?.message || e));
              setResult(null);
            } finally {
              setLoading(false);
            }
          }}
          style={{ opacity: profile && (profile.country_of_residence || residence.trim()) ? 1 : 0.6 }}
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
            {result.timeline_overview?.visa_compliance_status ? (
              <View style={styles.kv}>
                <Text style={styles.k}>Conformité</Text>
                <Text style={styles.v}>{result.timeline_overview.visa_compliance_status}</Text>
              </View>
            ) : null}
          </GlassCard>

          {result.alerts?.length ? (
            <GlassCard>
              <Text style={styles.cardTitle}>B. Alerts summary</Text>
              <View style={{ height: Tokens.space.sm }} />
              <View style={styles.row2}>
                <PrimaryButton title="Toutes" variant={alertFilter === "all" ? "brand" : "ghost"} onPress={() => setAlertFilter("all")} style={{ flex: 1 }} />
                <PrimaryButton title="Risques élevés" variant={alertFilter === "high" ? "brand" : "ghost"} onPress={() => setAlertFilter("high")} style={{ flex: 1 }} />
              </View>
              <View style={{ height: Tokens.space.sm }} />
              <PrimaryButton
                title={hideLowAlerts ? "Afficher alertes Low" : "Masquer alertes Low"}
                variant="ghost"
                onPress={() => setHideLowAlerts((v) => !v)}
              />
              {(result.alerts || [])
                .concat(localOverlapAlerts as any)
                .filter((a) => (alertFilter === "high" ? String(a.risk_level).toLowerCase() === "high" : true))
                .filter((a) => (hideLowAlerts ? String(a.risk_level).toLowerCase() !== "low" : true))
                .map((a, idx) => {
                  const rl = String(a.risk_level || "").toLowerCase();
                  const dot = rl === "high" ? Colors.danger : rl === "medium" ? Colors.warning : Colors.brandB;
                  return (
                    <View key={`${a.alert_type}_${idx}`} style={{ marginTop: Tokens.space.md }}>
                      <View style={styles.bulletRow}>
                        <View style={[styles.dot, { backgroundColor: dot }]} />
                        <Text style={styles.text}>
                          {a.alert_type}: {a.description}
                        </Text>
                      </View>
                      <Text style={styles.note}>Action: {a.suggested_action} · Risque: {a.risk_level}</Text>
                    </View>
                  );
                })}
            </GlassCard>
          ) : result.coherence_warnings?.length ? (
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
            <Text style={styles.cardTitle}>A. Travel plan</Text>
            <View style={{ height: Tokens.space.sm }} />
            {result.itinerary.slice(0, 12).map((d) => (
              <View key={`${d.day}-${d.date}-${d.country_or_city}`} style={styles.dayRow}>
                <Text style={styles.dayTitle}>
                  Étape {d.day} — {d.country_or_city} ({d.date}) · {d.activity_type || "—"}
                </Text>
                {d.activities.map((a) => (
                  <View key={a} style={styles.bulletRow}>
                    <View style={[styles.dot, { backgroundColor: Colors.faint }]} />
                    <Text style={styles.text}>{a}</Text>
                  </View>
                ))}
                <Text style={styles.note}>{d.accommodation_note}</Text>
                {(d.notes || []).length ? <Text style={styles.note}>Notes: {(d.notes || []).join(" · ")}</Text> : null}
                <View style={{ height: Tokens.space.sm }} />
              </View>
            ))}
            {result.itinerary.length > 12 ? <Text style={styles.body}>…itinéraire tronqué (12 premiers jours).</Text> : null}
          </GlassCard>

          {result.timeline_overview ? (
            <GlassCard>
              <Text style={styles.cardTitle}>C. Timeline overview</Text>
              <Text style={styles.body}>
                Durée totale: {result.timeline_overview.total_trip_duration_days} jours · Conformité: {result.timeline_overview.visa_compliance_status}
              </Text>
              <View style={{ height: Tokens.space.sm }} />
              {(result.timeline_overview.next_recommended_steps || []).map((s) => (
                <View key={s} style={styles.bulletRow}>
                  <View style={[styles.dot, { backgroundColor: Colors.brandB }]} />
                  <Text style={styles.text}>{s}</Text>
                </View>
              ))}
            </GlassCard>
          ) : null}

          <GlassCard>
            <Text style={styles.cardTitle}>Actions</Text>
            <Text style={styles.body}>
              “Would you like me to: 1) Adjust for maximum visa compliance 2) Highlight high-risk steps 3) Export a timeline and reminder checklist?”
            </Text>
            <View style={{ height: Tokens.space.md }} />
            <View style={styles.row2}>
              <PrimaryButton
                title="1) Max compliance"
                variant="ghost"
                onPress={() => {
                  setMode("simulation");
                  setMaximizeCompliance(true);
                }}
                style={{ flex: 1 }}
              />
              <PrimaryButton title="2) High-risk steps" variant="ghost" onPress={() => setAlertFilter("high")} style={{ flex: 1 }} />
            </View>
            <View style={{ height: Tokens.space.sm }} />
            <PrimaryButton
              title="3) Export timeline & checklist"
              onPress={async () => {
                if (!profile || !result) return;
                const visaType = insights?.lastDossier?.visa_type || result.visa_type || "unknown";
                const visaId = await upsertVisa({ country: String(result.destination || destination), visaType: String(visaType), objective: String(profile.travel_purpose || "travel"), stage: "application" });
                // Add key itinerary events: departure and return
                await addManualEvent({ visaId, title: "Départ (itinéraire)", type: "other" as any, dateIso: result.start_date });
                await addManualEvent({ visaId, title: "Retour (itinéraire)", type: "other" as any, dateIso: result.end_date });
              }}
            />
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

