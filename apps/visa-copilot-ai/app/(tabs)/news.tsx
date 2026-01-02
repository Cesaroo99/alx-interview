import React, { useMemo, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, TextInput, View } from "react-native";

import { Api, NewsItem } from "@/src/api/client";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { Badge } from "@/src/ui/Badge";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";
import { SkeletonCard } from "@/src/ui/Skeleton";

export default function NewsScreen() {
  const [country, setCountry] = useState("");
  const [category, setCategory] = useState<string>("");
  const [tag, setTag] = useState("");
  const [q, setQ] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<NewsItem[]>([]);

  const categoryChips = useMemo(() => {
    return [
      { key: "", label: "Tout" },
      { key: "visa_news", label: "Nouveautés visa" },
      { key: "law_change", label: "Lois & exigences" },
    ];
  }, []);

  async function run() {
    setError(null);
    setLoading(true);
    try {
      const r = await Api.news({
        country: country.trim() || undefined,
        category: category || undefined,
        tag: tag.trim() || undefined,
        q: q.trim() || undefined,
        limit: 50,
      });
      setItems(r.items || []);
    } catch (e: any) {
      setError(e?.message || "Erreur API");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Actualités visa & lois</Text>
        <Text style={styles.subtitle}>Flux indicatif: toujours vérifier la source officielle avant action.</Text>
      </View>

      <GlassCard>
        <Text style={styles.cardTitle}>Filtres</Text>
        <View style={{ height: Tokens.space.sm }} />
        <TextInput
          placeholder="Pays (ex: Canada)"
          placeholderTextColor="rgba(245,247,255,0.40)"
          value={country}
          onChangeText={setCountry}
          style={styles.input}
          autoCapitalize="words"
        />
        <View style={{ height: Tokens.space.sm }} />
        <TextInput
          placeholder="Tag (ex: work, student...)"
          placeholderTextColor="rgba(245,247,255,0.40)"
          value={tag}
          onChangeText={setTag}
          style={styles.input}
          autoCapitalize="none"
        />
        <View style={{ height: Tokens.space.sm }} />
        <TextInput
          placeholder="Recherche (titre, résumé...)"
          placeholderTextColor="rgba(245,247,255,0.40)"
          value={q}
          onChangeText={setQ}
          style={styles.input}
          autoCapitalize="none"
        />

        <View style={{ height: Tokens.space.md }} />
        <View style={styles.chipsRow}>
          {categoryChips.map((c) => (
            <PrimaryButton
              key={c.key}
              title={c.label}
              variant={category === c.key ? "brand" : "ghost"}
              onPress={() => setCategory(c.key)}
            />
          ))}
        </View>

        <View style={{ height: Tokens.space.md }} />
        <PrimaryButton title={loading ? "Chargement..." : "Charger"} onPress={run} />
        {loading ? (
          <View style={{ marginTop: Tokens.space.sm }}>
            <ActivityIndicator />
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </GlassCard>

      <View style={{ height: Tokens.space.md }} />

      {loading && items.length === 0 ? (
        <>
          <SkeletonCard />
          <View style={{ height: Tokens.space.md }} />
          <SkeletonCard />
        </>
      ) : null}

      {items.map((it) => (
        <View key={it.id} style={{ marginBottom: Tokens.space.md }}>
          <GlassCard>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{it.title || "Actualité"}</Text>
                <Text style={styles.meta}>
                  {it.country} · {it.category === "law_change" ? "loi/exigence" : "visa"} · {it.published_at || "date inconnue"}
                </Text>
              </View>
              <Badge
                label={it.reliability_score >= 0.75 ? "Source forte" : it.reliability_score >= 0.6 ? "Source ok" : "À confirmer"}
                tone={it.reliability_score >= 0.75 ? "success" : it.reliability_score >= 0.6 ? "neutral" : "warning"}
              />
            </View>

            {it.summary ? (
              <>
                <View style={{ height: Tokens.space.sm }} />
                <Text style={styles.body}>{it.summary}</Text>
              </>
            ) : null}

            <View style={{ height: Tokens.space.sm }} />
            <View style={styles.badgesRow}>
              {(it.tags || []).slice(0, 6).map((t) => (
                  <Badge key={`${it.id}-${t}`} label={t} tone="neutral" />
              ))}
            </View>

            <View style={{ height: Tokens.space.md }} />
            <View style={styles.actionsRow}>
              {it.source_url ? (
                <PrimaryButton title="Ouvrir la source" variant="ghost" onPress={() => Linking.openURL(it.source_url)} />
              ) : null}
              {it.source_name ? <Badge label={it.source_name} tone="neutral" /> : null}
            </View>

            <View style={{ height: Tokens.space.sm }} />
            <Text style={styles.disclaimer}>{it.disclaimer}</Text>
          </GlassCard>
        </View>
      ))}

      {!loading && items.length === 0 ? (
        <GlassCard>
          <Text style={styles.cardTitle}>Aucune actualité</Text>
          <Text style={styles.body}>Essayez un autre pays, ou laissez vide pour voir l’ensemble.</Text>
        </GlassCard>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 8 },
  title: { color: Colors.text, fontSize: Tokens.font.size.xxl, fontWeight: Tokens.font.weight.black },
  subtitle: { color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  cardTitle: { color: Colors.text, fontSize: Tokens.font.size.lg, fontWeight: Tokens.font.weight.bold },
  meta: { marginTop: 6, color: Colors.faint, fontSize: Tokens.font.size.sm },
  body: { color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  disclaimer: { color: Colors.faint, fontSize: Tokens.font.size.sm, lineHeight: 20 },
  error: { marginTop: Tokens.space.sm, color: Colors.danger, fontSize: Tokens.font.size.sm },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "rgba(255,255,255,0.05)",
    color: Colors.text,
    borderRadius: Tokens.radius.lg,
    paddingHorizontal: Tokens.space.md,
    paddingVertical: Tokens.space.md,
    fontSize: Tokens.font.size.md,
  },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  badgesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" },
  rowBetween: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
});

