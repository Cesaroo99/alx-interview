import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";

import { type DocumentType, useDocuments } from "@/src/state/documents";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";

const TYPES: Array<{ key: DocumentType; label: string }> = [
  { key: "passport", label: "Passeport" },
  { key: "photo", label: "Photo" },
  { key: "bank_statement", label: "Relevé bancaire" },
  { key: "payslips", label: "Fiches de paie" },
  { key: "employment_letter", label: "Attestation employeur" },
  { key: "business_registration", label: "Registre / entreprise" },
  { key: "student_certificate", label: "Certificat étudiant" },
  { key: "enrollment_letter", label: "Lettre d’inscription" },
  { key: "invitation_letter", label: "Lettre d’invitation" },
  { key: "travel_insurance", label: "Assurance voyage" },
  { key: "itinerary", label: "Itinéraire" },
  { key: "accommodation_plan", label: "Hébergement" },
  { key: "civil_status", label: "État civil" },
  { key: "sponsor_letter", label: "Lettre de sponsor" },
  { key: "refusal_letter", label: "Refus de visa (confidentiel)" },
  { key: "other", label: "Autre" },
];

function sanitize(name: string) {
  return name.replace(/[^\w.\-]+/g, "_");
}

export default function AddDocumentModal() {
  const params = useLocalSearchParams<{ doc_type?: string }>();
  const { addDoc } = useDocuments();
  const [docType, setDocType] = useState<DocumentType>("passport");
  const [picked, setPicked] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const canSave = useMemo(() => !!picked, [picked]);

  useEffect(() => {
    const raw = String(params?.doc_type || "").trim();
    if (!raw) return;
    const isKnown = TYPES.some((t) => t.key === raw);
    if (isKnown) setDocType(raw as DocumentType);
  }, [params?.doc_type]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Ajouter un document</Text>
        <Text style={styles.subtitle}>Importez un PDF ou une photo. L’OCR/IA sera branché ensuite.</Text>
      </View>

      <GlassCard>
        <Text style={styles.cardTitle}>Type</Text>
        <View style={{ height: Tokens.space.md }} />
        <View style={styles.grid}>
          {TYPES.map((t) => (
            <PrimaryButton
              key={t.key}
              title={t.label}
              variant={docType === t.key ? "brand" : "ghost"}
              onPress={() => setDocType(t.key)}
              style={styles.choice}
            />
          ))}
        </View>
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Fichier</Text>
        <Text style={styles.body}>{picked ? `${picked.name} (${picked.mimeType || "—"})` : "Aucun fichier sélectionné."}</Text>
        <View style={{ height: Tokens.space.lg }} />
        <PrimaryButton
          title="Choisir un fichier"
          onPress={async () => {
            const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
            if (res.canceled) return;
            setPicked(res.assets[0] || null);
          }}
        />
      </GlassCard>

      <View style={styles.actions}>
        <PrimaryButton title="Annuler" variant="ghost" onPress={() => router.back()} style={{ flex: 1 }} />
        <PrimaryButton
          title="Enregistrer"
          onPress={async () => {
            if (!picked) return;
            const dir = `${FileSystem.documentDirectory}globalvisa_docs/`;
            await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
            const filename = sanitize(picked.name || `document_${Date.now()}`);
            const dest = `${dir}${Date.now()}_${filename}`;
            await FileSystem.copyAsync({ from: picked.uri, to: dest });
            await addDoc({
              doc_type: docType,
              filename: picked.name || filename,
              uri: dest,
              mimeType: picked.mimeType || undefined,
              size: picked.size || undefined,
              extracted: {},
            });
            router.back();
          }}
          style={{ flex: 1, opacity: canSave ? 1 : 0.6 }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 8 },
  title: { color: Colors.text, fontSize: Tokens.font.size.xxl, fontWeight: Tokens.font.weight.black },
  subtitle: { color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  cardTitle: { color: Colors.text, fontSize: Tokens.font.size.lg, fontWeight: Tokens.font.weight.bold },
  body: { marginTop: Tokens.space.sm, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6 },
  choice: { flexGrow: 1, minWidth: "48%" },
  actions: { flexDirection: "row", gap: Tokens.space.sm },
});

