import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";

import { Api, type CostEngineResponse } from "@/src/api/client";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";
import { useInsights } from "@/src/state/insights";
import { useProfile } from "@/src/state/profile";
import { useVisaTimeline } from "@/src/state/visa_timeline";

function parseMoneyOrNull(s: string): number | null {
  const raw = s.trim().replace(",", ".");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

type FeeRow = {
  id: string;
  category: string;
  label: string;
  amountText: string;
  official: boolean;
  optional: boolean;
};

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T09:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CostsScreen() {
  const { profile } = useProfile();
  const { insights } = useInsights();
  const { upsertVisa, addManualEvent } = useVisaTimeline();

  const [destinationRegion, setDestinationRegion] = useState(profile?.destination_region_hint || "Zone Schengen");
  const [visaType, setVisaType] = useState("Visa visiteur / tourisme");
  const [currency, setCurrency] = useState("EUR");

  const [fees, setFees] = useState<FeeRow[]>(() => [
    { id: "visa_fee", category: "visa_fee", label: "Frais de visa (officiel)", amountText: "90", official: true, optional: false },
    { id: "service", category: "service", label: "Frais de service (centre agréé) — si applicable", amountText: "30", official: true, optional: false },
    { id: "biometrics", category: "biometrics", label: "Biométrie — si applicable", amountText: "", official: true, optional: false },
    { id: "government", category: "government", label: "Charges gouvernementales obligatoires — si applicable", amountText: "", official: true, optional: false },
    { id: "insurance", category: "insurance", label: "Assurance voyage (optionnel)", amountText: "40", official: false, optional: true },
    { id: "courier", category: "courier", label: "Courrier / retour passeport (optionnel)", amountText: "15", official: false, optional: true },
    { id: "translation", category: "translation", label: "Traductions certifiées (optionnel)", amountText: "60", official: false, optional: true },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CostEngineResponse | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<Record<string, boolean>>({});
  const [exportOpen, setExportOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentDateIso, setPaymentDateIso] = useState("");
  const lastRunKey = useRef<string>("");
  const debounceRef = useRef<any>(null);

  const totalsHint = useMemo(() => {
    const total = fees.reduce((acc, f) => acc + (parseMoneyOrNull(f.amountText) || 0), 0);
    return total > 0 ? `Total (provisoire): ${Math.round(total)} ${currency}` : null;
  }, [fees, currency]);

  const payloadFees = useMemo(
    () =>
      fees.map((f) => ({
        category: f.category,
        label: f.label,
        amount: parseMoneyOrNull(f.amountText),
        official: f.official,
        optional: f.optional,
        notes: [],
      })),
    [fees]
  );

  const run = useMemo(
    () => async () => {
      const key = JSON.stringify({ destinationRegion, visaType, currency, payloadFees });
      if (key === lastRunKey.current) return;
      lastRunKey.current = key;
      setLoading(true);
      setError(null);
      try {
        const res = await Api.estimateCostsEngine({
          destination_region: destinationRegion,
          visa_type: visaType,
          currency: currency.trim() || "USD",
          fees: payloadFees,
        });
        setResult(res);
      } catch (e: any) {
        setError(String(e?.message || e));
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [currency, destinationRegion, payloadFees, visaType]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const anyKnown = payloadFees.some((x) => x.amount !== null);
      if (anyKnown) void run();
    }, 450);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [payloadFees, destinationRegion, visaType, currency, run]);

  const exportText = useMemo(() => {
    if (!result) return "";
    const rows = result.items
      .map((i) => {
        const amt = i.amount == null ? "—" : `${Math.round(i.amount)} ${i.currency}`;
        const tag = i.official ? "Officiel" : i.optional ? "Optionnel" : "Autre";
        return `- ${i.category} | ${amt} | ${tag} | ${i.label}`;
      })
      .join("\n");
    const alerts = (result.suspicious_fees_alerts || [])
      .map((a) => `- [${a.risk_level}] ${a.fee_flagged}: ${a.reason_for_suspicion} → ${a.suggested_action}`)
      .join("\n");
    return [
      `Destination/zone: ${result.destination_region}`,
      `Type de visa: ${result.visa_type}`,
      `Devise: ${result.currency}`,
      "",
      "A. Résumé des coûts",
      "Category | Amount | Official / Optional | Notes",
      rows,
      "",
      `Total estimé: ${Math.round(result.totals.total_estimated)} ${result.currency}`,
      "",
      "B. Alertes / frais suspects",
      alerts || "- Aucun",
      "",
      "C. Conseils",
      ...(result.guidance || []).map((g) => `- ${g}`),
    ].join("\n");
  }, [result]);

  const visaHint = useMemo(() => {
    const d = insights?.lastDossier;
    return {
      country: String(d?.destination_region || destinationRegion || "unknown"),
      visaType: String(d?.visa_type || visaType || "unknown"),
      objective: "visa",
      stage: "application" as const,
    };
  }, [destinationRegion, insights, visaType]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Estimation des coûts</Text>
        <Text style={styles.subtitle}>
          Entrez les frais officiels (ambassade/gouvernement/centre agréé). Saisie partielle acceptée: le total affiché est une estimation.
        </Text>
      </View>

      <GlassCard>
        <Text style={styles.cardTitle}>Contexte</Text>
        <View style={{ height: Tokens.space.md }} />

        <Text style={styles.label}>Destination / zone</Text>
        <TextInput
          value={destinationRegion}
          onChangeText={setDestinationRegion}
          placeholder="Ex: Zone Schengen"
          placeholderTextColor="rgba(245,247,255,0.35)"
          style={styles.input}
        />

        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>Type de visa</Text>
        <TextInput
          value={visaType}
          onChangeText={setVisaType}
          placeholder="Ex: Visa visiteur / tourisme"
          placeholderTextColor="rgba(245,247,255,0.35)"
          style={styles.input}
        />

        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>Devise</Text>
        <View style={styles.row2}>
          <PrimaryButton title="EUR" variant={currency === "EUR" ? "brand" : "ghost"} onPress={() => setCurrency("EUR")} style={{ flex: 1 }} />
          <PrimaryButton title="USD" variant={currency === "USD" ? "brand" : "ghost"} onPress={() => setCurrency("USD")} style={{ flex: 1 }} />
          <PrimaryButton title="Autre" variant={currency !== "EUR" && currency !== "USD" ? "brand" : "ghost"} onPress={() => setCurrency("X")} style={{ flex: 1 }} />
        </View>
        {currency === "X" ? (
          <TextInput
            value={currency}
            onChangeText={setCurrency}
            placeholder="Ex: XOF"
            placeholderTextColor="rgba(245,247,255,0.35)"
            autoCapitalize="characters"
            style={styles.input}
          />
        ) : null}
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Montants (éditables)</Text>
        <Text style={styles.body}>Ajoutez/retirez des lignes, et corrigez les montants si une alerte est signalée.</Text>
        <View style={{ height: Tokens.space.md }} />

        {fees.map((f) => (
          <View key={f.id} style={styles.feeRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Libellé</Text>
              <TextInput
                value={f.label}
                onChangeText={(t) => setFees((prev) => prev.map((x) => (x.id === f.id ? { ...x, label: t } : x)))}
                style={styles.input}
                placeholderTextColor="rgba(16,22,47,0.35)"
              />

              <View style={{ height: Tokens.space.md }} />
              <Text style={styles.label}>Montant ({currency})</Text>
              <TextInput
                value={f.amountText}
                onChangeText={(t) => setFees((prev) => prev.map((x) => (x.id === f.id ? { ...x, amountText: t } : x)))}
                keyboardType="numeric"
                style={styles.input}
                placeholder="Ex: 90"
                placeholderTextColor="rgba(16,22,47,0.35)"
              />

              <View style={{ height: Tokens.space.sm }} />
              <View style={styles.row2}>
                <PrimaryButton
                  title="Officiel"
                  variant={f.official ? "brand" : "ghost"}
                  onPress={() => setFees((prev) => prev.map((x) => (x.id === f.id ? { ...x, official: true, optional: false } : x)))}
                  style={{ flex: 1 }}
                />
                <PrimaryButton
                  title="Optionnel"
                  variant={f.optional ? "brand" : "ghost"}
                  onPress={() => setFees((prev) => prev.map((x) => (x.id === f.id ? { ...x, official: false, optional: true } : x)))}
                  style={{ flex: 1 }}
                />
              </View>

              <View style={{ height: Tokens.space.sm }} />
              <Text style={styles.label}>Catégorie</Text>
              <View style={styles.row2}>
                {[
                  ["visa_fee", "Visa"],
                  ["service", "Service"],
                  ["biometrics", "Bio"],
                  ["government", "Gov"],
                ].map(([key, title]) => (
                  <PrimaryButton
                    key={key}
                    title={title}
                    variant={f.category === key ? "brand" : "ghost"}
                    onPress={() => setFees((prev) => prev.map((x) => (x.id === f.id ? { ...x, category: key } : x)))}
                    style={{ flex: 1 }}
                  />
                ))}
              </View>
              <View style={{ height: Tokens.space.sm }} />
              <View style={styles.row2}>
                {[
                  ["insurance", "Assurance"],
                  ["courier", "Courrier"],
                  ["translation", "Traductions"],
                  ["other", "Autre"],
                ].map(([key, title]) => (
                  <PrimaryButton
                    key={key}
                    title={title}
                    variant={f.category === key ? "brand" : "ghost"}
                    onPress={() => setFees((prev) => prev.map((x) => (x.id === f.id ? { ...x, category: key } : x)))}
                    style={{ flex: 1 }}
                  />
                ))}
              </View>
            </View>
            {String(f.id).startsWith("custom_") ? (
              <View style={{ width: 120, marginLeft: Tokens.space.sm }}>
                <PrimaryButton title="Suppr." variant="ghost" onPress={() => setFees((prev) => prev.filter((x) => x.id !== f.id))} />
              </View>
            ) : null}
          </View>
        ))}

        {totalsHint ? <Text style={styles.hint}>{totalsHint}</Text> : null}

        <View style={{ height: Tokens.space.lg }} />
        <View style={styles.row2}>
          <PrimaryButton
            title="Ajouter un frais"
            variant="ghost"
            onPress={() =>
              setFees((prev) => [
                ...prev,
                { id: uid("custom"), category: "other", label: "Autre frais", amountText: "", official: false, optional: true },
              ])
            }
            style={{ flex: 1 }}
          />
          <PrimaryButton title={loading ? "Analyse…" : "Analyser"} onPress={run} style={{ flex: 1 }} />
        </View>
      </GlassCard>

      {loading ? (
        <GlassCard>
          <View style={styles.loadingRow}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Calcul des coûts…</Text>
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
            <Text style={styles.cardTitle}>A. Résumé des coûts</Text>
            <View style={{ height: Tokens.space.sm }} />
            <View style={styles.kv}>
              <Text style={styles.k}>Total</Text>
              <Text style={styles.v}>
                {Math.round(result.totals.total_estimated)} {result.currency}
              </Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.k}>Officiel</Text>
              <Text style={styles.v}>
                {Math.round(result.totals.total_official)} {result.currency}
              </Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.k}>Optionnel</Text>
              <Text style={styles.v}>
                {Math.round(result.totals.total_optional)} {result.currency}
              </Text>
            </View>
            {result.totals.unknown_count ? <Text style={styles.body}>Montants inconnus: {result.totals.unknown_count} (total provisoire).</Text> : null}
          </GlassCard>

          <GlassCard>
            <Text style={styles.cardTitle}>Détail</Text>
            <View style={{ height: Tokens.space.sm }} />
            {result.items.map((i) => {
              const amt = i.amount == null ? "—" : `${Math.round(i.amount)} ${i.currency}`;
              const tag = i.official ? "Officiel" : i.optional ? "Optionnel" : "Autre";
              return (
                <View key={`${i.category}_${i.label}`} style={styles.itemRow}>
                  <View style={[styles.dot, { backgroundColor: i.official ? Colors.brandA : i.optional ? Colors.faint : Colors.warning }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>
                      {i.category} · {tag} — {amt}
                    </Text>
                    <Text style={styles.note}>{i.label}</Text>
                  </View>
                </View>
              );
            })}
          </GlassCard>

          {(result.suspicious_fees_alerts || []).filter((a) => !dismissedAlerts[a.fee_flagged]).length ? (
            <GlassCard>
              <Text style={styles.cardTitle}>B. Alertes / frais suspects</Text>
              <View style={{ height: Tokens.space.sm }} />
              {(result.suspicious_fees_alerts || [])
                .filter((a) => !dismissedAlerts[a.fee_flagged])
                .map((a) => (
                  <View key={`${a.fee_flagged}_${a.reason_for_suspicion}`} style={styles.alertCard}>
                    <Text style={styles.alertTitle}>
                      [{a.risk_level}] {a.fee_flagged}
                    </Text>
                    <Text style={styles.text}>{a.reason_for_suspicion}</Text>
                    <Text style={styles.note}>{a.suggested_action}</Text>
                    <View style={{ height: Tokens.space.sm }} />
                    <View style={styles.row2}>
                      <PrimaryButton
                        title="Confirmer"
                        variant="ghost"
                        onPress={() => setDismissedAlerts((p) => ({ ...p, [a.fee_flagged]: true }))}
                        style={{ flex: 1 }}
                      />
                      <PrimaryButton title="Corriger" variant="ghost" onPress={() => setDismissedAlerts((p) => p)} style={{ flex: 1 }} />
                    </View>
                  </View>
                ))}
            </GlassCard>
          ) : null}

          <GlassCard>
            <Text style={styles.cardTitle}>C. Conseils</Text>
            <View style={{ height: Tokens.space.sm }} />
            {(result.guidance || []).map((s) => (
              <View key={s} style={styles.bulletRow}>
                <View style={[styles.dot, { backgroundColor: Colors.brandB }]} />
                <Text style={styles.text}>{s}</Text>
              </View>
            ))}
          </GlassCard>

          <GlassCard>
            <Text style={styles.cardTitle}>Notes</Text>
            <View style={{ height: Tokens.space.sm }} />
            <View style={styles.bulletRow}>
              <View style={[styles.dot, { backgroundColor: Colors.faint }]} />
              <Text style={styles.text}>{result.disclaimer || "Estimation: vérifiez la source officielle avant paiement."}</Text>
            </View>
          </GlassCard>

          <GlassCard>
            <Text style={styles.cardTitle}>Votre choix</Text>
            <Text style={styles.body}>{result.final_user_prompt || "Souhaitez-vous sauvegarder / rappels / vérifier les mises à jour ?"}</Text>
            <View style={{ height: Tokens.space.md }} />
            <View style={styles.row2}>
              <PrimaryButton
                title="1) Sauver (timeline)"
                onPress={async () => {
                  const visaId = await upsertVisa(visaHint);
                  await addManualEvent({
                    visaId,
                    type: "payment",
                    title: `Estimation coûts visa — ${Math.round(result.totals.total_estimated)} ${result.currency}`,
                    notes: exportText,
                    meta: { cost_engine: result },
                  });
                }}
                style={{ flex: 1 }}
              />
              <PrimaryButton title="Exporter" variant="ghost" onPress={() => setExportOpen(true)} style={{ flex: 1 }} />
            </View>
            <View style={{ height: Tokens.space.sm }} />
            <View style={styles.row2}>
              <PrimaryButton title="2) Rappels paiements" variant="ghost" onPress={() => setPaymentOpen(true)} style={{ flex: 1 }} />
              <PrimaryButton
                title="3) Vérifier mises à jour"
                variant="ghost"
                onPress={async () => {
                  const visaId = await upsertVisa(visaHint);
                  await addManualEvent({
                    visaId,
                    type: "other",
                    title: "Vérifier les frais officiels (mise à jour)",
                    dateIso: addDaysIso(todayIso(), 30),
                    notes: "Rappel: confirmer les tarifs sur la source officielle (ambassade/gouvernement/centre agréé).",
                  });
                }}
                style={{ flex: 1 }}
              />
            </View>
          </GlassCard>
        </>
      ) : null}

      {exportOpen ? (
        <View style={styles.overlay}>
          <GlassCard>
            <Text style={styles.cardTitle}>Export (texte)</Text>
            <Text style={styles.body}>Copiez ce texte pour votre planning.</Text>
            <View style={{ height: Tokens.space.sm }} />
            <TextInput value={exportText} editable={false} multiline style={[styles.input, { minHeight: 180 }]} />
            <View style={{ height: Tokens.space.md }} />
            <PrimaryButton title="Fermer" variant="ghost" onPress={() => setExportOpen(false)} />
          </GlassCard>
        </View>
      ) : null}

      {paymentOpen ? (
        <View style={styles.overlay}>
          <GlassCard>
            <Text style={styles.cardTitle}>Rappels de paiement</Text>
            <Text style={styles.body}>Date prévue de paiement (YYYY-MM-DD). On créera des rappels J‑14/J‑7/J‑3/J‑1/J‑0.</Text>
            <View style={{ height: Tokens.space.sm }} />
            <TextInput value={paymentDateIso} onChangeText={setPaymentDateIso} style={styles.input} placeholder="2026-01-15" placeholderTextColor="rgba(16,22,47,0.35)" />
            <View style={{ height: Tokens.space.md }} />
            <View style={styles.row2}>
              <PrimaryButton title="Annuler" variant="ghost" onPress={() => setPaymentOpen(false)} style={{ flex: 1 }} />
              <PrimaryButton
                title="Créer"
                onPress={async () => {
                  if (!result) return;
                  const iso = paymentDateIso.trim();
                  if (iso.length < 8) return;
                  const visaId = await upsertVisa(visaHint);
                  await addManualEvent({
                    visaId,
                    type: "payment",
                    title: `Paiement frais visa — ${Math.round(result.totals.total_estimated)} ${result.currency}`,
                    dateIso: iso,
                    notes: exportText,
                    meta: { cost_engine: result },
                  });
                  setPaymentDateIso("");
                  setPaymentOpen(false);
                }}
                style={{ flex: 1, opacity: paymentDateIso.trim().length >= 8 ? 1 : 0.6 }}
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
  hint: { marginTop: Tokens.space.sm, color: Colors.faint, fontSize: Tokens.font.size.sm, lineHeight: 20 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  loadingText: { color: Colors.muted, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.medium },
  error: { color: Colors.warning, fontSize: Tokens.font.size.md, lineHeight: 22 },
  kv: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  k: { color: Colors.faint, fontSize: Tokens.font.size.sm, width: 120 },
  v: { color: Colors.text, fontSize: Tokens.font.size.sm, fontWeight: Tokens.font.weight.semibold, flex: 1 },
  bulletRow: { flexDirection: "row", gap: 10, marginTop: Tokens.space.sm, alignItems: "flex-start" },
  dot: { width: 10, height: 10, borderRadius: 99, marginTop: 6 },
  text: { flex: 1, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  itemRow: { flexDirection: "row", gap: 10, marginTop: Tokens.space.md, alignItems: "flex-start" },
  itemTitle: { color: Colors.text, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.bold, lineHeight: 22 },
  note: { marginTop: 4, color: Colors.faint, fontSize: Tokens.font.size.sm, lineHeight: 20 },
  feeRow: { marginTop: Tokens.space.lg },
  alertCard: { marginTop: Tokens.space.md, padding: Tokens.space.md, borderRadius: Tokens.radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card2 },
  alertTitle: { color: Colors.text, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.bold, lineHeight: 22 },
  overlay: { position: "absolute", left: 0, right: 0, bottom: 0, padding: Tokens.space.xl },
});

