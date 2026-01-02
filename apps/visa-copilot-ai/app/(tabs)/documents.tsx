import React, { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import { Api } from "@/src/api/client";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { AnimatedIn } from "@/src/ui/AnimatedIn";
import { Badge } from "@/src/ui/Badge";
import { GlassCard } from "@/src/ui/GlassCard";
import { HeroBanner } from "@/src/ui/HeroBanner";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";
import { SkeletonCard } from "@/src/ui/Skeleton";
import { ScorePill } from "@/src/ui/ScorePill";
import { useDocuments } from "@/src/state/documents";
import { useInsights } from "@/src/state/insights";
import { useProfile } from "@/src/state/profile";

function parseIso(s?: unknown): Date | null {
  if (!s) return null;
  const str = String(s).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(d.getTime()) ? d : null;
}

function daysUntil(d: Date) {
  const ms = d.getTime() - Date.now();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function docStatus(doc: any): { tone: "success" | "warning" | "danger" | "neutral"; label: string } {
  // heuristiques locales (OCR à brancher). On se base sur extracted.* si présent.
  if (doc.doc_type === "passport") {
    const exp = parseIso(doc.extracted?.expires_date);
    if (!exp) return { tone: "warning", label: "À compléter" };
    const d = daysUntil(exp);
    if (d < 0) return { tone: "danger", label: "Expiré" };
    if (d < 180) return { tone: "warning", label: "< 6 mois" };
    return { tone: "success", label: "OK" };
  }
  if (doc.doc_type === "bank_statement") {
    const issued = parseIso(doc.extracted?.issued_date);
    if (!issued) return { tone: "warning", label: "À compléter" };
    const age = Math.floor((Date.now() - issued.getTime()) / (1000 * 60 * 60 * 24));
    if (age > 120) return { tone: "warning", label: "Ancien" };
    return { tone: "success", label: "Récent" };
  }
  if (doc.doc_type === "travel_insurance") {
    const exp = parseIso(doc.extracted?.expires_date);
    if (!exp) return { tone: "warning", label: "À compléter" };
    const d = daysUntil(exp);
    if (d < 0) return { tone: "warning", label: "Expirée" };
    return { tone: "success", label: "OK" };
  }
  return { tone: "neutral", label: "Ajouté" };
}

export default function DocumentsScreen() {
  const { docs, clearAll, removeDoc } = useDocuments();
  const { profile } = useProfile();
  const { setLastDossier } = useInsights();
  const [destination, setDestination] = useState(profile?.destination_region_hint || "Zone Schengen");
  const [visaType, setVisaType] = useState("Visa visiteur / tourisme");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quick, setQuick] = useState<any>(null);

  const payloadDocs = useMemo(
    () =>
      docs.map((d) => ({
        doc_id: d.id,
        doc_type: d.doc_type,
        filename: d.filename,
        extracted: d.extracted || {},
      })),
    [docs]
  );

  const refusalDoc = useMemo(() => docs.find((d) => d.doc_type === "refusal_letter") || null, [docs]);

  return (
    <Screen>
      <HeroBanner
        kicker="Coffre"
        title="Documents"
        subtitle="Centralise tes pièces et lance une analyse dossier en 1 clic (OCR/IA à brancher ensuite)."
      />

      <AnimatedIn delayMs={0}>
        <GlassCard>
        <Text style={styles.cardTitle}>Votre coffre</Text>
        <Text style={styles.body}>
          Ajoutez vos documents (passeport, relevés, attestations). On vous dira quoi corriger.
        </Text>
        <View style={{ height: Tokens.space.lg }} />
        <PrimaryButton title="Ajouter un document" onPress={() => router.push("/documents/add")} />
        {refusalDoc ? (
          <>
            <View style={{ height: Tokens.space.sm }} />
            <PrimaryButton
              title="Analyse confidentielle du refus"
              variant="ghost"
              onPress={() => router.push({ pathname: "/tools/refusal", params: { doc_id: refusalDoc.id } })}
            />
          </>
        ) : null}
        {docs.length ? (
          <>
            <View style={{ height: Tokens.space.sm }} />
            <PrimaryButton title="Tout supprimer" variant="ghost" onPress={() => clearAll()} />
          </>
        ) : null}
          <View style={{ height: Tokens.space.md }} />
          <PrimaryButton
            title="Ouvrir la vérification dossier"
            variant="ghost"
            onPress={() => router.push("/(tabs)/dossier")}
            style={{ opacity: profile ? 1 : 0.6 }}
          />
        </GlassCard>
      </AnimatedIn>

      <AnimatedIn delayMs={80}>
        <GlassCard>
          <View style={styles.rowTop}>
            <Text style={styles.cardTitle}>Analyse rapide (Docs → Dossier)</Text>
            {loading ? <ActivityIndicator /> : null}
          </View>
          <Text style={styles.body}>
            Vérifie en 1 clic la cohérence du dossier avec les documents actuels (sans quitter l’écran).
          </Text>
          <View style={{ height: Tokens.space.md }} />
          <Text style={styles.label}>Destination / zone</Text>
          <TextInput
            value={destination}
            onChangeText={setDestination}
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
          <View style={{ height: Tokens.space.lg }} />
          <PrimaryButton
            title={loading ? "Analyse…" : "Analyser maintenant"}
            onPress={async () => {
              if (!profile) {
                setError("Profil manquant: complétez l’onboarding.");
                return;
              }
              setLoading(true);
              setError(null);
              try {
                const res = await Api.verifyDossier({
                  profile,
                  visa_type: visaType,
                  destination_region: destination,
                  documents: payloadDocs,
                });
                setQuick(res);
                await setLastDossier({
                  readiness_score: Number(res.readiness_score || 0),
                  coherence_score: Number(res.coherence_score || 0),
                  readiness_level: String(res.readiness_level || "—"),
                  key_risks: Array.isArray(res.key_risks) ? res.key_risks : [],
                  next_best_actions: Array.isArray(res.next_best_actions) ? res.next_best_actions : [],
                  destination_region: destination,
                  visa_type: visaType,
                });
              } catch (e: any) {
                setError(String(e?.message || e));
              } finally {
                setLoading(false);
              }
            }}
            style={{ opacity: profile && docs.length ? 1 : 0.6 }}
          />
          {loading ? (
            <View style={{ marginTop: Tokens.space.md }}>
              <SkeletonCard />
            </View>
          ) : error ? (
            <Text style={[styles.body, { color: Colors.warning }]}>{error}</Text>
          ) : quick ? (
            <View style={{ marginTop: Tokens.space.md, gap: Tokens.space.sm }}>
              <ScorePill label="Readiness dossier" value={Number(quick.readiness_score || 0)} />
              <Text style={styles.body}>
                Cohérence: {Math.round(Number(quick.coherence_score || 0))}/100 · Niveau: {String(quick.readiness_level || "—")}
              </Text>
              {(quick.key_risks || []).slice(0, 3).map((r: string) => (
                <View key={r} style={styles.bulletRow}>
                  <View style={[styles.bulletDot, { backgroundColor: Colors.danger }]} />
                  <Text style={styles.bulletText}>{r}</Text>
                </View>
              ))}
              <PrimaryButton title="Voir détails" variant="ghost" onPress={() => router.push("/(tabs)/dossier")} />
            </View>
          ) : null}
        </GlassCard>
      </AnimatedIn>

      {docs.length ? (
        <AnimatedIn delayMs={120}>
          <GlassCard>
            <Text style={styles.cardTitle}>Fichiers</Text>
            <View style={{ height: Tokens.space.sm }} />
            {docs.map((d) => (
              <View key={d.id} style={styles.docRow}>
                <View style={styles.icon}>
                  <FontAwesome name="file-text" size={18} color={Colors.brandB} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={styles.docName}>
                    {d.filename}
                  </Text>
                  <Text style={styles.docMeta}>
                    {d.doc_type} · {d.size ? `${Math.round(d.size / 1024)} KB` : "—"}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 8 }}>
                  <Badge {...docStatus(d)} />
                  <PrimaryButton title="Détails" variant="ghost" onPress={() => router.push({ pathname: "/documents/edit", params: { id: d.id } })} />
                  <PrimaryButton title="Supprimer" variant="ghost" onPress={() => removeDoc(d.id)} />
                </View>
              </View>
            ))}
          </GlassCard>
        </AnimatedIn>
      ) : null}

      <AnimatedIn delayMs={200}>
        <GlassCard>
          <Text style={styles.cardTitle}>Badges</Text>
          <View style={{ height: Tokens.space.sm }} />
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: "rgba(39,226,164,0.12)", borderColor: "rgba(39,226,164,0.35)" }]}>
              <Text style={styles.badgeText}>Valide</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: "rgba(255,176,32,0.12)", borderColor: "rgba(255,176,32,0.35)" }]}>
              <Text style={styles.badgeText}>À corriger</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: "rgba(255,77,109,0.12)", borderColor: "rgba(255,77,109,0.35)" }]}>
              <Text style={styles.badgeText}>Critique</Text>
            </View>
          </View>
        </GlassCard>
      </AnimatedIn>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { color: Colors.text, fontSize: Tokens.font.size.lg, fontWeight: Tokens.font.weight.bold },
  body: { marginTop: Tokens.space.sm, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  badgeRow: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: Tokens.space.sm },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  badgeText: { color: Colors.text, fontSize: Tokens.font.size.sm, fontWeight: Tokens.font.weight.semibold },
  docRow: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: Tokens.space.md },
  docName: { color: Colors.text, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.bold },
  docMeta: { color: Colors.faint, fontSize: Tokens.font.size.sm, marginTop: 4 },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(46,233,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(46,233,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { color: Colors.faint, fontSize: Tokens.font.size.sm, fontWeight: Tokens.font.weight.medium, marginTop: 6 },
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
  bulletRow: { flexDirection: "row", gap: 10, marginTop: Tokens.space.sm, alignItems: "flex-start" },
  bulletDot: { width: 8, height: 8, borderRadius: 99, marginTop: 6, backgroundColor: Colors.brandA },
  bulletText: { flex: 1, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
});

