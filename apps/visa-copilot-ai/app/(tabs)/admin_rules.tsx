import React, { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";

import { Api } from "@/src/api/client";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { AnimatedIn } from "@/src/ui/AnimatedIn";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";

export default function AdminRulesScreen() {
  const [adminKey, setAdminKey] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const parsed = useMemo(() => {
    try {
      if (!jsonText.trim()) return null;
      return JSON.parse(jsonText);
    } catch {
      return null;
    }
  }, [jsonText]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Admin · Règles éligibilité</Text>
        <Text style={styles.subtitle}>
          Permet de modifier les règles sans changer le code. À utiliser uniquement en environnement admin.
        </Text>
      </View>

      <AnimatedIn delayMs={0}>
        <GlassCard>
          <Text style={styles.cardTitle}>Clé admin</Text>
          <TextInput
            value={adminKey}
            onChangeText={setAdminKey}
            placeholder="GLOBALVISA_ADMIN_KEY"
            placeholderTextColor="rgba(245,247,255,0.35)"
            style={styles.input}
            secureTextEntry
          />
          <Text style={styles.hint}>
            Cette clé ne doit pas être stockée côté client en production. Entrez-la manuellement.
          </Text>
        </GlassCard>
      </AnimatedIn>

      <AnimatedIn delayMs={90}>
        <GlassCard>
          <View style={styles.rowTop}>
            <Text style={styles.cardTitle}>Règles JSON</Text>
            {loading ? <ActivityIndicator /> : null}
          </View>
          <TextInput
            value={jsonText}
            onChangeText={setJsonText}
            placeholder="{ ... }"
            placeholderTextColor="rgba(245,247,255,0.35)"
            style={[styles.input, styles.textarea]}
            multiline
          />
          <View style={{ height: Tokens.space.md }} />
          <View style={styles.row}>
            <PrimaryButton
              title="Charger"
              variant="ghost"
              onPress={async () => {
                setLoading(true);
                setStatus("");
                try {
                  const res = await Api.adminGetEligibilityRules(adminKey);
                  setJsonText(JSON.stringify(res.rules, null, 2));
                  setStatus(`Chargé (${res.source}) depuis ${res.path}`);
                } catch (e: any) {
                  setStatus(String(e?.message || e));
                } finally {
                  setLoading(false);
                }
              }}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              title="Valider"
              variant="ghost"
              onPress={async () => {
                if (!parsed) {
                  setStatus("JSON invalide (parse error).");
                  return;
                }
                setLoading(true);
                setStatus("");
                try {
                  const res = await Api.adminValidateEligibilityRules(adminKey, parsed);
                  const msg = res.ok
                    ? `OK ✅ (${res.warnings.length} warning)`
                    : `KO ❌ (${res.errors.length} erreurs, ${res.warnings.length} warnings)`;
                  setStatus(msg + (res.errors.length ? `\n- ${res.errors.join("\n- ")}` : "") + (res.warnings.length ? `\n⚠ ${res.warnings.join("\n⚠ ")}` : ""));
                } catch (e: any) {
                  setStatus(String(e?.message || e));
                } finally {
                  setLoading(false);
                }
              }}
              style={{ flex: 1 }}
            />
          </View>
          <View style={{ height: Tokens.space.sm }} />
          <View style={styles.row}>
            <PrimaryButton
              title="Publier (override)"
              onPress={async () => {
                if (!parsed) {
                  setStatus("JSON invalide (parse error).");
                  return;
                }
                setLoading(true);
                setStatus("");
                try {
                  const res = await Api.adminPutEligibilityRules(adminKey, parsed);
                  setStatus(`Publié ✅ ${res.saved_to}`);
                } catch (e: any) {
                  setStatus(String(e?.message || e));
                } finally {
                  setLoading(false);
                }
              }}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              title="Supprimer override"
              variant="danger"
              onPress={async () => {
                setLoading(true);
                setStatus("");
                try {
                  const res = await Api.adminDeleteEligibilityRules(adminKey);
                  setStatus(res.deleted ? "Override supprimé ✅" : "Aucun override à supprimer.");
                } catch (e: any) {
                  setStatus(String(e?.message || e));
                } finally {
                  setLoading(false);
                }
              }}
              style={{ flex: 1 }}
            />
          </View>

          {status ? <Text style={[styles.hint, { marginTop: Tokens.space.md }]}>{status}</Text> : null}
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
  textarea: { minHeight: 220, textAlignVertical: "top" as const },
  row: { flexDirection: "row", gap: 10 },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  hint: { color: Colors.faint, fontSize: Tokens.font.size.sm, lineHeight: 20, marginTop: Tokens.space.sm },
});

