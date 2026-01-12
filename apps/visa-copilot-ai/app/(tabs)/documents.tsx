import React, { useMemo } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { useColors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { AppText } from "@/src/ui/AppText";
import { Badge } from "@/src/ui/Badge";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";
import { useDocuments } from "@/src/state/documents";

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
  const colors = useColors();
  const { docs, removeDoc, clearAll } = useDocuments();

  const sorted = useMemo(() => (docs || []).slice().sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)), [docs]);

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <AppText variant="h1">Documents</AppText>
          <AppText tone="muted">Bibliothèque de pièces. Chaque document impacte automatiquement le Visa Journey et la vérification.</AppText>
        </View>
        <PrimaryButton title="Ajouter un document" onPress={() => router.push("/documents/add")} />
      </View>

      {sorted.length ? (
        <GlassCard>
          <View style={styles.rowTop}>
            <AppText variant="h3">Votre bibliothèque</AppText>
            <PrimaryButton
              title="Tout supprimer"
              variant="ghost"
              onPress={() => {
                Alert.alert("Supprimer tous les documents ?", "Cette action est irréversible.", [
                  { text: "Annuler", style: "cancel" },
                  { text: "Supprimer", style: "destructive", onPress: () => void clearAll() },
                ]);
              }}
            />
          </View>

          {sorted.map((d) => (
            <View key={d.id} style={[styles.docCard, { borderColor: colors.border, backgroundColor: colors.card2 }]}>
              <View style={styles.docTop}>
                <View style={{ flex: 1 }}>
                  <AppText numberOfLines={1} variant="bodyStrong">
                    {d.filename || "Document"}
                  </AppText>
                  <AppText variant="caption" tone="faint" style={styles.docMeta}>
                    {d.doc_type} · {d.size ? `${Math.round(d.size / 1024)} KB` : "—"}
                  </AppText>
                </View>
                <Badge {...docStatus(d)} />
              </View>

              <View style={{ height: Tokens.space.sm }} />
              <View style={styles.actionsRow}>
                <PrimaryButton title="Voir" variant="ghost" onPress={() => router.push({ pathname: "/documents/edit", params: { id: d.id } })} style={{ flex: 1 }} />
                <PrimaryButton title="Remplacer" variant="ghost" onPress={() => router.push({ pathname: "/documents/edit", params: { id: d.id } })} style={{ flex: 1 }} />
                <PrimaryButton title="Supprimer" variant="ghost" onPress={() => removeDoc(d.id)} style={{ flex: 1 }} />
              </View>
            </View>
          ))}
        </GlassCard>
      ) : (
        <GlassCard>
          <AppText variant="h3">Aucun document</AppText>
          <AppText tone="muted" style={styles.body}>
            Commencez par ajouter votre passeport, puis vos relevés/attestations.
          </AppText>
          <View style={{ height: Tokens.space.md }} />
          <PrimaryButton title="Ajouter un document" onPress={() => router.push("/documents/add")} />
        </GlassCard>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  title: {},
  subtitle: { marginTop: 6 },
  cardTitle: {},
  body: { marginTop: Tokens.space.sm },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  docCard: { marginTop: Tokens.space.md, padding: Tokens.space.md, borderRadius: Tokens.radius.lg, borderWidth: 1 },
  docTop: { flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "space-between" },
  docName: {},
  docMeta: { marginTop: 4 },
  actionsRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
});

