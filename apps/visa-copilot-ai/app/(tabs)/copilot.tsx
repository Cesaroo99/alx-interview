import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";

import { Api } from "@/src/api/client";
import { useColors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { AppText } from "@/src/ui/AppText";
import { AnimatedIn } from "@/src/ui/AnimatedIn";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";
import { useProfile } from "@/src/state/profile";

type Msg = { id: string; role: "user" | "assistant"; text: string };

export default function CopilotScreen() {
  const colors = useColors();
  const { profile } = useProfile();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "m1",
      role: "assistant",
      text: "Je suis votre Copilot. Dites-moi votre destination et votre motif, et je vous guide étape par étape (sans soumission).",
    },
  ]);

  const quick = useMemo(
    () => [
      "Quels documents sont indispensables ?",
      "Pourquoi je risque un refus ?",
      "Comment remplir ce champ correctement ?",
      "Vérifie si ce site est officiel",
    ],
    []
  );

  return (
    <Screen scroll={false}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <AppText variant="h1">Copilot IA</AppText>
              <AppText tone="muted">Chat contextuel + actions rapides (visa‑first, official‑only).</AppText>
            </View>
            <View style={[styles.headerIconWrap, { borderColor: colors.border, backgroundColor: colors.card2 }]}>
              <Image source={require("../../assets/images/adaptive-icon.png")} style={styles.headerIcon} />
            </View>
          </View>
        </View>

        <GlassCard style={{ flex: 1, padding: Tokens.space.md }}>
          <FlatList
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ paddingBottom: Tokens.space.md }}
            renderItem={({ item }) => (
              <AnimatedIn delayMs={0} direction="up">
                <View
                  style={[
                    styles.bubble,
                    { borderColor: colors.border },
                    item.role === "user"
                      ? [styles.userBubble, { borderColor: "rgba(124,92,255,0.35)" }]
                      : [styles.aiBubble, { backgroundColor: colors.card2 }],
                  ]}>
                  <AppText>{item.text}</AppText>
                </View>
              </AnimatedIn>
            )}
          />
        </GlassCard>

        <View style={styles.quickRow}>
          {quick.slice(0, 2).map((q) => (
            <PrimaryButton
              key={q}
              title={q}
              variant="ghost"
              onPress={() => {
                setInput(q);
              }}
              style={styles.quickBtn}
            />
          ))}
        </View>

        <View style={styles.composer}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Écrivez votre question…"
            placeholderTextColor={colors.faint}
            style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card2, color: colors.text }]}
          />
          <PrimaryButton
            title={loading ? "…" : "Envoyer"}
            onPress={async () => {
              const text = input.trim();
              if (!text || loading) return;
              setInput("");
              setMessages((prev) => [...prev, { id: `u${Date.now()}`, role: "user", text }]);
              setLoading(true);
              try {
                const res = await Api.copilotChat(profile, text);
                setMessages((prev) => [...prev, { id: `a${Date.now()}`, role: "assistant", text: res.answer }]);
                const open = res.quick_actions?.find((a) => a.type === "open" && a.target);
                if (open?.target === "security") {
                  // suggestion non intrusive: pas de redirection auto
                }
              } catch (e: any) {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: `e${Date.now()}`,
                    role: "assistant",
                    text:
                      "Je n’arrive pas à joindre l’API Copilot. Astuce: démarrez l’API FastAPI et configurez EXPO_PUBLIC_API_BASE_URL.",
                  },
                ]);
              } finally {
                setLoading(false);
              }
            }}
            style={{ width: 110 }}
          />
        </View>

        <View style={styles.footerRow}>
          {loading ? <ActivityIndicator /> : null}
          <AppText variant="caption" tone="faint" style={styles.footer}>
            {profile ? `Profil chargé: ${profile.nationality} · ${profile.profession}` : "Profil non chargé"}
          </AppText>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Tokens.space.xl, gap: Tokens.space.md },
  header: { gap: 6 },
  headerTop: { flexDirection: "row", gap: 12, alignItems: "center" },
  headerIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIcon: { width: 30, height: 30, resizeMode: "contain" },
  bubble: {
    maxWidth: "92%",
    paddingVertical: Tokens.space.sm,
    paddingHorizontal: Tokens.space.md,
    borderRadius: Tokens.radius.lg,
    marginTop: Tokens.space.sm,
    borderWidth: 1,
  },
  aiBubble: { alignSelf: "flex-start" },
  userBubble: { alignSelf: "flex-end", backgroundColor: "rgba(124,92,255,0.18)", borderColor: "rgba(124,92,255,0.35)" },
  composer: { flexDirection: "row", gap: Tokens.space.sm, alignItems: "center" },
  input: {
    flex: 1,
    borderRadius: Tokens.radius.lg,
    borderWidth: 1,
    paddingHorizontal: Tokens.space.md,
    paddingVertical: Tokens.space.md,
  },
  quickRow: { flexDirection: "row", gap: Tokens.space.sm },
  quickBtn: { flex: 1, paddingHorizontal: 12 },
  footer: { textAlign: "center" },
  footerRow: { flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center" },
});

