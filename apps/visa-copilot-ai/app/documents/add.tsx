import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";

import { type DocumentType, useDocuments } from "@/src/state/documents";
import { Api } from "@/src/api/client";
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
  const { addDoc, updateDoc } = useDocuments();
  const [docType, setDocType] = useState<DocumentType>("passport");
  const [picked, setPicked] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const canSave = useMemo(() => !!picked, [picked]);
  const [ocrAuto, setOcrAuto] = useState(true);
  const [ocrStatus, setOcrStatus] = useState<string>("");

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
        <View style={{ height: Tokens.space.sm }} />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <PrimaryButton title={ocrAuto ? "OCR auto: ON" : "OCR auto: OFF"} variant="ghost" onPress={() => setOcrAuto((v) => !v)} style={{ flex: 1 }} />
        </View>
        {ocrStatus ? <Text style={styles.body}>{ocrStatus}</Text> : null}
      </GlassCard>

      <View style={styles.actions}>
        <PrimaryButton title="Annuler" variant="ghost" onPress={() => router.back()} style={{ flex: 1 }} />
        <PrimaryButton
          title="Enregistrer"
          onPress={async () => {
            if (!picked) return;
            const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
            if (!baseDir) throw new Error("Stockage indisponible.");
            const dir = `${baseDir}globalvisa_docs/`;
            await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
            const filename = sanitize(picked.name || `document_${Date.now()}`);
            const dest = `${dir}${Date.now()}_${filename}`;
            await FileSystem.copyAsync({ from: picked.uri, to: dest });
            const created = await addDoc({
              doc_type: docType,
              filename: picked.name || filename,
              uri: dest,
              mimeType: picked.mimeType || undefined,
              size: picked.size || undefined,
              extracted: {},
            });
            if (ocrAuto) {
              try {
                setOcrStatus("Extraction OCR…");
                const info = await FileSystem.getInfoAsync(dest);
                const size = info && (info as any).exists ? (info as any).size : undefined;
                if (typeof size === "number" && size > 3_000_000) {
                  setOcrStatus("OCR ignoré (fichier volumineux). Ouvrez le document et lancez l’OCR manuellement.");
                } else {
                  const b64 = await FileSystem.readAsStringAsync(dest, { encoding: FileSystem.EncodingType.Base64 });
                  const res = await Api.ocrExtract({ content_base64: b64, mime_type: picked.mimeType || "application/octet-stream" });
                  // write extracted back into stored doc
                  const extracted = { ...(created.extracted || {}), ...(res.extracted || {}) };
                  await updateDoc(created.id, { extracted });
                  setOcrStatus(res.warnings?.length ? `OCR fini (avec avertissements).` : "OCR fini.");
                }
              } catch {
                setOcrStatus("OCR non disponible (vous pouvez remplir manuellement les champs extraits).");
              }
            }
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

