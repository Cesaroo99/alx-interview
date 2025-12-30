import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { Api } from "@/src/api/client";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { AnimatedIn } from "@/src/ui/AnimatedIn";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";
import { useProfile } from "@/src/state/profile";

type Msg = { id: string; role: "user" | "assistant"; text: string };

export default function CopilotScreen() {
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
          <Text style={styles.title}>Copilot IA</Text>
          <Text style={styles.subtitle}>Chat contextuel (type WhatsApp/ChatGPT) + actions rapides.</Text>
        </View>

        <GlassCard style={{ flex: 1, padding: Tokens.space.md }}>
          <FlatList
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ paddingBottom: Tokens.space.md }}
            renderItem={({ item }) => (
              <AnimatedIn delayMs={0} direction="up">
                <View style={[styles.bubble, item.role === "user" ? styles.userBubble : styles.aiBubble]}>
                  <Text style={styles.bubbleText}>{item.text}</Text>
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
            placeholderTextColor="rgba(245,247,255,0.35)"
            style={styles.input}
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
          <Text style={styles.footer}>
            {profile ? `Profil chargé: ${profile.nationality} · ${profile.profession}` : "Profil non chargé"}
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Tokens.space.xl, gap: Tokens.space.md },
  header: { gap: 6 },
  title: { color: Colors.text, fontSize: Tokens.font.size.xxl, fontWeight: Tokens.font.weight.black },
  subtitle: { color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  bubble: {
    maxWidth: "92%",
    paddingVertical: Tokens.space.sm,
    paddingHorizontal: Tokens.space.md,
    borderRadius: Tokens.radius.lg,
    marginTop: Tokens.space.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  aiBubble: { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.06)" },
  userBubble: { alignSelf: "flex-end", backgroundColor: "rgba(124,92,255,0.18)", borderColor: "rgba(124,92,255,0.35)" },
  bubbleText: { color: Colors.text, fontSize: Tokens.font.size.md, lineHeight: 22 },
  composer: { flexDirection: "row", gap: Tokens.space.sm, alignItems: "center" },
  input: {
    flex: 1,
    borderRadius: Tokens.radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card2,
    paddingHorizontal: Tokens.space.md,
    paddingVertical: Tokens.space.md,
    color: Colors.text,
    fontSize: Tokens.font.size.md,
  },
  quickRow: { flexDirection: "row", gap: Tokens.space.sm },
  quickBtn: { flex: 1, paddingHorizontal: 12 },
  footer: { color: Colors.faint, fontSize: Tokens.font.size.sm, textAlign: "center" },
  footerRow: { flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center" },
});

