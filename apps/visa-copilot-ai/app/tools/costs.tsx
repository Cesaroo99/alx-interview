import React, { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";

import { Api, type EstimateCostsResponse } from "@/src/api/client";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";
import { useProfile } from "@/src/state/profile";

function parseMoneyOrNull(s: string): number | null {
  const raw = s.trim().replace(",", ".");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export default function CostsScreen() {
  const { profile } = useProfile();

  const [destinationRegion, setDestinationRegion] = useState(profile?.destination_region_hint || "Zone Schengen");
  const [visaType, setVisaType] = useState("Visa visiteur / tourisme");
  const [currency, setCurrency] = useState("EUR");

  const [visaFee, setVisaFee] = useState("90");
  const [serviceFee, setServiceFee] = useState("30");
  const [biometricsFee, setBiometricsFee] = useState("");
  const [translationCost, setTranslationCost] = useState("60");
  const [insuranceCost, setInsuranceCost] = useState("40");
  const [courierCost, setCourierCost] = useState("15");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EstimateCostsResponse | null>(null);

  const totalsHint = useMemo(() => {
    const a = parseMoneyOrNull(visaFee) || 0;
    const b = parseMoneyOrNull(serviceFee) || 0;
    const c = parseMoneyOrNull(biometricsFee) || 0;
    const d = parseMoneyOrNull(translationCost) || 0;
    const e = parseMoneyOrNull(insuranceCost) || 0;
    const f = parseMoneyOrNull(courierCost) || 0;
    const total = a + b + c + d + e + f;
    return total > 0 ? `Total (approx): ${Math.round(total)} ${currency}` : null;
  }, [visaFee, serviceFee, biometricsFee, translationCost, insuranceCost, courierCost, currency]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Estimation des coûts</Text>
        <Text style={styles.subtitle}>
          Tu entres les montants depuis les sources officielles, on calcule et on signale les risques (frais anormaux).
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
        <Text style={styles.cardTitle}>Montants</Text>
        <Text style={styles.body}>Laisse vide si non applicable / inconnu.</Text>
        <View style={{ height: Tokens.space.md }} />

        <Text style={styles.label}>Frais de visa (officiel)</Text>
        <TextInput value={visaFee} onChangeText={setVisaFee} keyboardType="numeric" style={styles.input} placeholderTextColor="rgba(245,247,255,0.35)" />

        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>Frais de service (centre agréé)</Text>
        <TextInput value={serviceFee} onChangeText={setServiceFee} keyboardType="numeric" style={styles.input} placeholderTextColor="rgba(245,247,255,0.35)" />

        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>Biométrie (si applicable)</Text>
        <TextInput value={biometricsFee} onChangeText={setBiometricsFee} keyboardType="numeric" style={styles.input} placeholderTextColor="rgba(245,247,255,0.35)" />

        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>Traductions certifiées (estimation)</Text>
        <TextInput value={translationCost} onChangeText={setTranslationCost} keyboardType="numeric" style={styles.input} placeholderTextColor="rgba(245,247,255,0.35)" />

        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>Assurance voyage (estimation)</Text>
        <TextInput value={insuranceCost} onChangeText={setInsuranceCost} keyboardType="numeric" style={styles.input} placeholderTextColor="rgba(245,247,255,0.35)" />

        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>Courrier / retour passeport (estimation)</Text>
        <TextInput value={courierCost} onChangeText={setCourierCost} keyboardType="numeric" style={styles.input} placeholderTextColor="rgba(245,247,255,0.35)" />

        {totalsHint ? <Text style={styles.hint}>{totalsHint}</Text> : null}

        <View style={{ height: Tokens.space.lg }} />
        <PrimaryButton
          title={loading ? "Calcul…" : "Calculer"}
          onPress={async () => {
            setLoading(true);
            setError(null);
            try {
              const res = await Api.estimateCosts({
                destination_region: destinationRegion,
                visa_type: visaType,
                currency: currency.trim() || "USD",
                visa_fee: parseMoneyOrNull(visaFee),
                service_fee: parseMoneyOrNull(serviceFee),
                biometrics_fee: parseMoneyOrNull(biometricsFee),
                translation_cost: parseMoneyOrNull(translationCost),
                insurance_cost: parseMoneyOrNull(insuranceCost),
                courier_cost: parseMoneyOrNull(courierCost),
              });
              setResult(res);
            } catch (e: any) {
              setError(String(e?.message || e));
              setResult(null);
            } finally {
              setLoading(false);
            }
          }}
        />
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
            <Text style={styles.cardTitle}>Résumé</Text>
            <View style={{ height: Tokens.space.sm }} />
            <View style={styles.kv}>
              <Text style={styles.k}>Total</Text>
              <Text style={styles.v}>
                {Math.round(result.total)} {result.currency}
              </Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.k}>Obligatoire</Text>
              <Text style={styles.v}>
                {Math.round(result.total_mandatory)} {result.currency}
              </Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.k}>Optionnel</Text>
              <Text style={styles.v}>
                {Math.round(result.total_optional)} {result.currency}
              </Text>
            </View>
          </GlassCard>

          <GlassCard>
            <Text style={styles.cardTitle}>Détail</Text>
            <View style={{ height: Tokens.space.sm }} />
            {result.items.map((i) => (
              <View key={i.label} style={styles.itemRow}>
                <View style={[styles.dot, { backgroundColor: i.mandatory ? Colors.warning : Colors.faint }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>
                    {i.label} — {Math.round(i.amount)} {i.currency}
                  </Text>
                  {(i.why || []).slice(0, 2).map((w) => (
                    <Text key={w} style={styles.note}>
                      {w}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </GlassCard>

          {result.warnings?.length ? (
            <GlassCard>
              <Text style={styles.cardTitle}>Alertes</Text>
              <View style={{ height: Tokens.space.sm }} />
              {result.warnings.map((w) => (
                <View key={w} style={styles.bulletRow}>
                  <View style={[styles.dot, { backgroundColor: Colors.warning }]} />
                  <Text style={styles.text}>{w}</Text>
                </View>
              ))}
            </GlassCard>
          ) : null}

          <GlassCard>
            <Text style={styles.cardTitle}>Étapes suivantes</Text>
            <View style={{ height: Tokens.space.sm }} />
            {result.next_steps.map((s) => (
              <View key={s} style={styles.bulletRow}>
                <View style={[styles.dot, { backgroundColor: Colors.brandB }]} />
                <Text style={styles.text}>{s}</Text>
              </View>
            ))}
          </GlassCard>

          <GlassCard>
            <Text style={styles.cardTitle}>Notes</Text>
            <View style={{ height: Tokens.space.sm }} />
            {result.disclaimers.map((s) => (
              <View key={s} style={styles.bulletRow}>
                <View style={[styles.dot, { backgroundColor: Colors.faint }]} />
                <Text style={styles.text}>{s}</Text>
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
});

