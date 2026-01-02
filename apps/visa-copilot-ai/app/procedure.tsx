import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { Api, type PortalsResponse } from "@/src/api/client";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";
import { useInsights } from "@/src/state/insights";
import { useProfile } from "@/src/state/profile";
import { useVisaTimeline } from "@/src/state/visa_timeline";

function norm(s?: string) {
  return String(s || "").trim();
}

function guessFormType(countryOrRegion: string) {
  const x = norm(countryOrRegion).toLowerCase();
  if (x.includes("schengen") || x.includes("france") || x.includes("germany") || x.includes("spain") || x.includes("portugal")) return "schengen_visa";
  if (x.includes("uk") || x.includes("royaume")) return "uk_visit_visa";
  if (x.includes("usa") || x.includes("united states") || x.includes("états")) return "ds160_basic";
  return "schengen_visa";
}

function mapPortalId(countryOrRegion: string) {
  const x = norm(countryOrRegion).toLowerCase();
  if (x.includes("uk") || x.includes("royaume")) return "uk_visa";
  if (x.includes("usa") || x.includes("états")) return "us_ds160";
  if (x.includes("germany") || x.includes("allemagne")) return "germany_videx";
  if (x.includes("france") || x.includes("schengen")) return "france_visas";
  return "france_visas";
}

export default function ProcedureScreen() {
  const params = useLocalSearchParams<{ country?: string; visa_type?: string; portal_id?: string; url?: string; form_type?: string }>();
  const { profile } = useProfile();
  const { insights } = useInsights();
  const { upsertVisa } = useVisaTimeline();

  const [manualUrl, setManualUrl] = useState(norm(params.url) || "https://");
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [portalData, setPortalData] = useState<PortalsResponse | null>(null);

  const country = norm(params.country) || norm(insights?.lastDossier?.destination_region) || "unknown";
  const visaType = norm(params.visa_type) || norm(insights?.lastDossier?.visa_type) || "unknown";
  const portalId = norm(params.portal_id) || mapPortalId(country);
  const formType = norm(params.form_type) || guessFormType(country);

  const steps = useMemo(
    () => [
      { key: "account", label: "Créer/accéder au compte portail (si requis)", why: "Certains portails exigent un compte avant RDV/paiement." },
      { key: "form", label: "Remplir le formulaire (assistant disponible)", why: "Cohérence profil ↔ documents ↔ dates." },
      { key: "appointment", label: "Prendre RDV / biométrie (si applicable)", why: "Les dates sont critiques; l’app peut détecter des dates." },
      { key: "payment", label: "Paiement officiel (si applicable)", why: "Éviter les frais non officiels; garder les reçus." },
      { key: "upload", label: "Uploader les documents (scans lisibles)", why: "Qualité des pièces = crédibilité." },
    ],
    []
  );

  async function resolvePortalUrl(): Promise<string> {
    if (manualUrl.startsWith("http")) return manualUrl;
    setLoadingPortal(true);
    try {
      const res = await Api.portals({});
      setPortalData(res);
      const hit = (res.items || []).find((x) => x.id === portalId);
      return hit?.official_url || "https://";
    } finally {
      setLoadingPortal(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Procédure (lancement)</Text>
        <Text style={styles.subtitle}>
          Guide opérationnel: ouvre le portail officiel dans l’app, active l’assistant de formulaire, et suit les étapes sans soumission automatique.
        </Text>
      </View>

      <GlassCard>
        <Text style={styles.cardTitle}>Contexte</Text>
        <Text style={styles.body}>
          Destination: {country} · Visa: {visaType} · Form: {formType}
        </Text>
        {!profile ? <Text style={styles.warn}>Profil manquant: l’assistant de champs ne pourra pas proposer de valeurs.</Text> : null}
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Portail</Text>
        <Text style={styles.body}>Si vous connaissez l’URL officielle exacte, collez-la ci‑dessous (sinon on utilise le catalogue).</Text>
        <TextInput value={manualUrl} onChangeText={setManualUrl} style={styles.input} placeholderTextColor="rgba(16,22,47,0.35)" />
        <View style={{ height: Tokens.space.md }} />
        <View style={styles.row2}>
          <PrimaryButton
            title={loadingPortal ? "Ouverture…" : "Ouvrir (assistant ON)"}
            onPress={async () => {
              const url = await resolvePortalUrl();
              const visaId = await upsertVisa({ country, visaType, objective: String(profile?.travel_purpose || "visa"), stage: "application" });
              void visaId;
              router.push({
                pathname: "/portal",
                params: { url, country, visa_type: visaType, stage: "application", objective: String(profile?.travel_purpose || "visa"), form_type: formType, assistant: "1" } as any,
              });
            }}
            style={{ flex: 1 }}
          />
          <PrimaryButton title="Ouvrir timeline" variant="ghost" onPress={() => router.push("/(tabs)/appointments")} style={{ flex: 1 }} />
        </View>
        {portalData?.disclaimer ? <Text style={styles.hint}>{portalData.disclaimer}</Text> : null}
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Étapes</Text>
        {steps.map((s, idx) => (
          <View key={s.key} style={styles.stepRow}>
            <Text style={styles.stepTitle}>
              {idx + 1}. {s.label}
            </Text>
            <Text style={styles.note}>{s.why}</Text>
          </View>
        ))}
        <View style={{ height: Tokens.space.md }} />
        <PrimaryButton title="Retour" variant="ghost" onPress={() => router.back()} />
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 8 },
  title: { color: Colors.text, fontSize: Tokens.font.size.xxl, fontWeight: Tokens.font.weight.black },
  subtitle: { color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  cardTitle: { color: Colors.text, fontSize: Tokens.font.size.lg, fontWeight: Tokens.font.weight.bold },
  body: { marginTop: Tokens.space.sm, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  warn: { marginTop: Tokens.space.sm, color: Colors.warning, fontSize: Tokens.font.size.sm, lineHeight: 20 },
  hint: { marginTop: Tokens.space.sm, color: Colors.faint, fontSize: Tokens.font.size.sm, lineHeight: 20 },
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
  stepRow: { marginTop: Tokens.space.md },
  stepTitle: { color: Colors.text, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.bold, lineHeight: 22 },
  note: { marginTop: 4, color: Colors.faint, fontSize: Tokens.font.size.sm, lineHeight: 20 },
});

