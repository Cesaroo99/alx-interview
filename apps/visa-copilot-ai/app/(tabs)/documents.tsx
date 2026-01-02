import React, { useMemo } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
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
  const { docs, removeDoc, clearAll } = useDocuments();

  const sorted = useMemo(() => (docs || []).slice().sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)), [docs]);

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Documents</Text>
          <Text style={styles.subtitle}>Bibliothèque de pièces. Chaque document impacte automatiquement le Visa Journey et la vérification.</Text>
        </View>
        <PrimaryButton title="Add document" onPress={() => router.push("/documents/add")} />
      </View>

      {sorted.length ? (
        <GlassCard>
          <View style={styles.rowTop}>
            <Text style={styles.cardTitle}>Votre bibliothèque</Text>
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
            <View key={d.id} style={styles.docCard}>
              <View style={styles.docTop}>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={styles.docName}>
                    {d.filename || "Document"}
                  </Text>
                  <Text style={styles.docMeta}>
                    {d.doc_type} · {d.size ? `${Math.round(d.size / 1024)} KB` : "—"}
                  </Text>
                </View>
                <Badge {...docStatus(d)} />
              </View>

              <View style={{ height: Tokens.space.sm }} />
              <View style={styles.actionsRow}>
                <PrimaryButton title="View" variant="ghost" onPress={() => router.push({ pathname: "/documents/edit", params: { id: d.id } })} style={{ flex: 1 }} />
                <PrimaryButton title="Replace" variant="ghost" onPress={() => router.push({ pathname: "/documents/edit", params: { id: d.id } })} style={{ flex: 1 }} />
                <PrimaryButton title="Delete" variant="ghost" onPress={() => removeDoc(d.id)} style={{ flex: 1 }} />
              </View>
            </View>
          ))}
        </GlassCard>
      ) : (
        <GlassCard>
          <Text style={styles.cardTitle}>Aucun document</Text>
          <Text style={styles.body}>Commencez par ajouter votre passeport, puis vos relevés/attestations.</Text>
          <View style={{ height: Tokens.space.md }} />
          <PrimaryButton title="Add document" onPress={() => router.push("/documents/add")} />
        </GlassCard>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  title: { color: Colors.text, fontSize: Tokens.font.size.xxl, fontWeight: Tokens.font.weight.black },
  subtitle: { marginTop: 6, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  cardTitle: { color: Colors.text, fontSize: Tokens.font.size.lg, fontWeight: Tokens.font.weight.bold },
  body: { marginTop: Tokens.space.sm, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  docCard: { marginTop: Tokens.space.md, padding: Tokens.space.md, borderRadius: Tokens.radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card2 },
  docTop: { flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "space-between" },
  docName: { color: Colors.text, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.bold },
  docMeta: { marginTop: 4, color: Colors.faint, fontSize: Tokens.font.size.sm },
  actionsRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
});

