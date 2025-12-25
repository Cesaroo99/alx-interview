import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";

import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { AnimatedIn } from "@/src/ui/AnimatedIn";
import { Badge } from "@/src/ui/Badge";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";
import { useDocuments } from "@/src/state/documents";
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
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Documents</Text>
        <Text style={styles.subtitle}>
          Upload + vérification automatique (OCR/IA). MVP: structure + checklist; OCR sera branché ensuite.
        </Text>
      </View>

      <AnimatedIn delayMs={0}>
        <GlassCard>
        <Text style={styles.cardTitle}>Votre coffre</Text>
        <Text style={styles.body}>
          Ajoutez vos documents (passeport, relevés, attestations). On vous dira quoi corriger.
        </Text>
        <View style={{ height: Tokens.space.lg }} />
        <PrimaryButton title="Ajouter un document" onPress={() => router.push("/documents/add")} />
        {docs.length ? (
          <>
            <View style={{ height: Tokens.space.sm }} />
            <PrimaryButton title="Tout supprimer" variant="ghost" onPress={() => clearAll()} />
          </>
        ) : null}
          <View style={{ height: Tokens.space.md }} />
          <PrimaryButton
            title="Vérifier le dossier (avec ces documents)"
            variant="ghost"
            onPress={() => router.push("/(tabs)/dossier")}
            style={{ opacity: profile ? 1 : 0.6 }}
          />
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
  header: { gap: 8 },
  title: { color: Colors.text, fontSize: Tokens.font.size.xxl, fontWeight: Tokens.font.weight.black },
  subtitle: { color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
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
});

