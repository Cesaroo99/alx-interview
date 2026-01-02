import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { Api, type PortalsResponse, type PrimaryChoicesResponse } from "@/src/api/client";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";
import { useInsights } from "@/src/state/insights";
import { useProfile } from "@/src/state/profile";

function norm(s?: string) {
  return String(s || "").trim();
}

export default function PortalsScreen() {
  const { profile } = useProfile();
  const { insights } = useInsights();

  const [choices, setChoices] = useState<PrimaryChoicesResponse | null>(null);
  const [data, setData] = useState<PortalsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [country, setCountry] = useState("");
  const [providerType, setProviderType] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    setCountry(String(insights?.lastDossier?.destination_region || "").trim().toLowerCase());
  }, [insights?.lastDossier?.destination_region]);

  useEffect(() => {
    (async () => {
      try {
        const c = await Api.primaryChoices();
        setChoices(c);
      } catch {
        // ignore
      }
    })();
  }, []);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await Api.portals({
        country: country.trim() || undefined,
        provider_type: providerType.trim() || undefined,
        q: q.trim() || undefined,
      });
      setData(res);
    } catch (e: any) {
      setError(String(e?.message || e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hint = useMemo(() => {
    const d = insights?.lastDossier;
    return {
      country: String(d?.destination_region || country || "unknown"),
      visaType: String(d?.visa_type || "unknown"),
      objective: String(d?.objective || profile?.travel_purpose || "visa"),
      stage: "research",
      form_type: String(d?.destination_region || "").toLowerCase().includes("schengen") ? "schengen_visa" : "schengen_visa",
    };
  }, [country, insights?.lastDossier, profile?.travel_purpose]);

  const items = useMemo(() => data?.items || [], [data?.items]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Portails & formulaires</Text>
        <Text style={styles.subtitle}>Ouvre les sites officiels dans l’app, et utilise l’assistant de remplissage (sans soumission automatique).</Text>
      </View>

      <GlassCard>
        <Text style={styles.cardTitle}>Filtres</Text>
        <View style={{ height: Tokens.space.md }} />

        <Text style={styles.label}>Pays (optionnel)</Text>
        <TextInput value={country} onChangeText={setCountry} placeholder="Ex: france" placeholderTextColor="rgba(16,22,47,0.35)" style={styles.input} />
        <Text style={styles.hint}>Astuce: mets “multi” pour TLS/VFS.</Text>

        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>Type</Text>
        <View style={styles.row2}>
          {(choices?.provider_types || []).slice(0, 4).map((t) => (
            <PrimaryButton
              key={t.key}
              title={t.label}
              variant={providerType === t.key ? "brand" : "ghost"}
              onPress={() => setProviderType((p) => (p === t.key ? "" : t.key))}
              style={{ flex: 1 }}
            />
          ))}
        </View>

        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>Recherche</Text>
        <TextInput value={q} onChangeText={setQ} placeholder="Ex: vfs" placeholderTextColor="rgba(16,22,47,0.35)" style={styles.input} />

        <View style={{ height: Tokens.space.lg }} />
        <PrimaryButton title={loading ? "Chargement…" : "Rechercher"} onPress={run} />
        {data?.disclaimer ? <Text style={styles.hint}>{data.disclaimer}</Text> : null}
      </GlassCard>

      {loading ? (
        <GlassCard>
          <View style={styles.loadingRow}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Chargement des portails…</Text>
          </View>
        </GlassCard>
      ) : error ? (
        <GlassCard>
          <Text style={styles.error}>{error}</Text>
        </GlassCard>
      ) : (
        <GlassCard>
          <Text style={styles.cardTitle}>Résultats</Text>
          <Text style={styles.body}>{items.length} portail(s)</Text>
          <View style={{ height: Tokens.space.sm }} />

          {items.map((p) => (
            <View key={p.id} style={styles.portalRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.portalTitle}>{p.name}</Text>
                <Text style={styles.portalMeta}>
                  {p.provider_type} · {p.country} · {p.official_url}
                </Text>
                <Text style={styles.portalMeta}>
                  Connexion: {p.login_required ? "souvent" : "pas nécessaire"} · Paiement: {p.payment_supported ? "oui" : "non"} · RDV:{" "}
                  {p.appointment_supported ? "oui" : "non"}
                </Text>
              </View>
              <View style={{ width: 140, gap: 8 }}>
                <PrimaryButton
                  title="Ouvrir"
                  onPress={() =>
                    router.push({
                      pathname: "/portal",
                      params: {
                        url: p.official_url,
                        country: hint.country,
                        visa_type: hint.visaType,
                        stage: "application",
                        objective: hint.objective,
                        form_type: (p.known_forms && p.known_forms[0]) || hint.form_type,
                      } as any,
                    })
                  }
                />
                <PrimaryButton
                  title="Form assistant"
                  variant="ghost"
                  onPress={() =>
                    router.push({
                      pathname: "/portal",
                      params: {
                        url: p.official_url,
                        country: hint.country,
                        visa_type: hint.visaType,
                        stage: "application",
                        objective: hint.objective,
                        form_type: (p.known_forms && p.known_forms[0]) || hint.form_type,
                        assistant: "1",
                      } as any,
                    })
                  }
                />
              </View>
            </View>
          ))}
          {!items.length ? <Text style={styles.body}>Aucun résultat. Essayez “multi” + “visa_center”.</Text> : null}
        </GlassCard>
      )}
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
  row2: { flexDirection: "row", gap: 10, marginTop: 8, flexWrap: "wrap" },
  hint: { marginTop: Tokens.space.sm, color: Colors.faint, fontSize: Tokens.font.size.sm, lineHeight: 20 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  loadingText: { color: Colors.muted, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.medium },
  error: { color: Colors.warning, fontSize: Tokens.font.size.md, lineHeight: 22 },
  portalRow: { flexDirection: "row", gap: 12, marginTop: Tokens.space.md, alignItems: "flex-start" },
  portalTitle: { color: Colors.text, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.bold, lineHeight: 22 },
  portalMeta: { marginTop: 4, color: Colors.faint, fontSize: Tokens.font.size.sm, lineHeight: 20 },
});

