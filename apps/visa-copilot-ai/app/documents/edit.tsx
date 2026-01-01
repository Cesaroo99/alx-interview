import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { useDocuments } from "@/src/state/documents";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";

export default function EditDocumentModal() {
  const { id, focus } = useLocalSearchParams<{ id?: string; focus?: string }>();
  const { docs, updateDoc, removeDoc } = useDocuments();
  const doc = useMemo(() => docs.find((d) => d.id === id), [docs, id]);

  const [expires, setExpires] = useState<string>(String(doc?.extracted?.expires_date || ""));
  const [issued, setIssued] = useState<string>(String(doc?.extracted?.issued_date || ""));
  const [balance, setBalance] = useState<string>(String(doc?.extracted?.ending_balance_usd || ""));
  const [fullName, setFullName] = useState<string>(String(doc?.extracted?.full_name || ""));
  const [passportNo, setPassportNo] = useState<string>(String(doc?.extracted?.passport_number || ""));
  const [accountHolderName, setAccountHolderName] = useState<string>(String(doc?.extracted?.account_holder_name || ""));
  const focusKey = String(focus || "").trim();

  if (!doc) {
    return (
      <Screen>
        <GlassCard>
          <Text style={styles.title}>Document introuvable</Text>
          <View style={{ height: Tokens.space.md }} />
          <PrimaryButton title="Fermer" onPress={() => router.back()} />
        </GlassCard>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.h1}>Détails</Text>
        <Text style={styles.sub}>{doc.filename}</Text>
      </View>

      <GlassCard>
        <Text style={styles.cardTitle}>Métadonnées (MVP)</Text>
        <Text style={styles.body}>Ces champs servent à la cohérence (expiration, fraîcheur, soldes). Format ISO recommandé.</Text>
        {focusKey ? <Text style={styles.focusHint}>À compléter: {focusKey}</Text> : null}

        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>full_name</Text>
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          style={[styles.input, focusKey === "full_name" ? styles.inputFocus : null]}
          placeholder="Ex: Mohamed El Amrani"
          placeholderTextColor="rgba(245,247,255,0.35)"
        />

        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>passport_number</Text>
        <TextInput
          value={passportNo}
          onChangeText={setPassportNo}
          style={[styles.input, focusKey === "passport_number" ? styles.inputFocus : null]}
          placeholder="Ex: AB1234567"
          placeholderTextColor="rgba(245,247,255,0.35)"
        />

        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>expires_date (YYYY-MM-DD)</Text>
        <TextInput
          value={expires}
          onChangeText={setExpires}
          style={[styles.input, focusKey === "expires_date" ? styles.inputFocus : null]}
          placeholderTextColor="rgba(245,247,255,0.35)"
        />

        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>issued_date (YYYY-MM-DD)</Text>
        <TextInput
          value={issued}
          onChangeText={setIssued}
          style={[styles.input, focusKey === "issued_date" ? styles.inputFocus : null]}
          placeholderTextColor="rgba(245,247,255,0.35)"
        />

        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>account_holder_name</Text>
        <TextInput
          value={accountHolderName}
          onChangeText={setAccountHolderName}
          style={[styles.input, focusKey === "account_holder_name" ? styles.inputFocus : null]}
          placeholder="Ex: Mohamed El Amrani"
          placeholderTextColor="rgba(245,247,255,0.35)"
        />

        <View style={{ height: Tokens.space.md }} />
        <Text style={styles.label}>ending_balance_usd</Text>
        <TextInput
          value={balance}
          onChangeText={setBalance}
          style={[styles.input, focusKey === "ending_balance_usd" ? styles.inputFocus : null]}
          keyboardType="numeric"
          placeholderTextColor="rgba(245,247,255,0.35)"
        />

        <View style={{ height: Tokens.space.lg }} />
        <View style={styles.row}>
          <PrimaryButton title="Supprimer" variant="danger" onPress={async () => { await removeDoc(doc.id); router.back(); }} style={{ flex: 1 }} />
          <PrimaryButton
            title="Enregistrer"
            onPress={async () => {
              const extracted = { ...(doc.extracted || {}) } as any;
              if (fullName.trim()) extracted.full_name = fullName.trim();
              else delete extracted.full_name;
              if (passportNo.trim()) extracted.passport_number = passportNo.trim();
              else delete extracted.passport_number;
              if (expires.trim()) extracted.expires_date = expires.trim();
              else delete extracted.expires_date;
              if (issued.trim()) extracted.issued_date = issued.trim();
              else delete extracted.issued_date;
              if (accountHolderName.trim()) extracted.account_holder_name = accountHolderName.trim();
              else delete extracted.account_holder_name;
              if (balance.trim()) extracted.ending_balance_usd = Number(balance);
              else delete extracted.ending_balance_usd;
              await updateDoc(doc.id, { extracted });
              router.back();
            }}
            style={{ flex: 1 }}
          />
        </View>
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 6 },
  h1: { color: Colors.text, fontSize: Tokens.font.size.xxl, fontWeight: Tokens.font.weight.black },
  sub: { color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  title: { color: Colors.text, fontSize: Tokens.font.size.lg, fontWeight: Tokens.font.weight.bold },
  cardTitle: { color: Colors.text, fontSize: Tokens.font.size.lg, fontWeight: Tokens.font.weight.bold },
  body: { marginTop: Tokens.space.sm, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  focusHint: { marginTop: Tokens.space.sm, color: Colors.brandB, fontSize: Tokens.font.size.sm, fontWeight: Tokens.font.weight.semibold },
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
  inputFocus: {
    borderColor: "rgba(46,233,255,0.70)",
    backgroundColor: "rgba(46,233,255,0.08)",
  },
  row: { flexDirection: "row", gap: 10 },
});

