import React, { useMemo, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, TextInput, View } from "react-native";

import { Api, OfficeItem } from "@/src/api/client";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { Badge } from "@/src/ui/Badge";
import { GlassCard } from "@/src/ui/GlassCard";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";
import { SkeletonCard } from "@/src/ui/Skeleton";

function mapsDirectionsUrl(item: OfficeItem) {
  if (item.geo?.lat && item.geo?.lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${item.geo.lat},${item.geo.lng}`)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address || `${item.name} ${item.city} ${item.country}`)}`;
}

function openContact(item: OfficeItem) {
  if (item.contacts?.email) {
    Linking.openURL(`mailto:${item.contacts.email}`);
    return;
  }
  if (item.contacts?.phone) {
    Linking.openURL(`tel:${item.contacts.phone}`);
  }
}

export default function OfficesScreen() {
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [type, setType] = useState<string>("");
  const [service, setService] = useState<string>("");
  const [q, setQ] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<OfficeItem[]>([]);

  const typeChips = useMemo(() => {
    return [
      { key: "", label: "Tous" },
      { key: "embassy", label: "Ambassade" },
      { key: "consulate", label: "Consulat" },
      { key: "tls", label: "TLS" },
      { key: "vfs", label: "VFS" },
    ];
  }, []);

  const serviceChips = useMemo(() => {
    return [
      { key: "", label: "Tous" },
      { key: "visa", label: "Visa" },
      { key: "passport", label: "Passeport" },
      { key: "biometrics", label: "Biométrie" },
    ];
  }, []);

  async function run() {
    setError(null);
    setLoading(true);
    try {
      const r = await Api.offices({
        country: country.trim() || undefined,
        city: city.trim() || undefined,
        type: type || undefined,
        service: service || undefined,
        q: q.trim() || undefined,
        verify_urls: true,
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
        <Text style={styles.title}>Ambassades & consulats</Text>
        <Text style={styles.subtitle}>Toujours privilégier les liens officiels, surtout avant paiement.</Text>
      </View>

      <GlassCard>
        <Text style={styles.cardTitle}>Filtres</Text>
        <View style={{ height: Tokens.space.sm }} />
        <TextInput
          placeholder="Pays (ex: France)"
          placeholderTextColor="rgba(245,247,255,0.40)"
          value={country}
          onChangeText={setCountry}
          style={styles.input}
          autoCapitalize="words"
        />
        <View style={{ height: Tokens.space.sm }} />
        <TextInput
          placeholder="Ville (ex: Paris)"
          placeholderTextColor="rgba(245,247,255,0.40)"
          value={city}
          onChangeText={setCity}
          style={styles.input}
          autoCapitalize="words"
        />
        <View style={{ height: Tokens.space.sm }} />
        <TextInput
          placeholder="Recherche (nom, adresse, service...)"
          placeholderTextColor="rgba(245,247,255,0.40)"
          value={q}
          onChangeText={setQ}
          style={styles.input}
          autoCapitalize="none"
        />

        <View style={{ height: Tokens.space.md }} />
        <View style={styles.chipsRow}>
          {typeChips.map((c) => (
            <PrimaryButton
              key={c.key}
              title={c.label}
              variant={type === c.key ? "primary" : "ghost"}
              onPress={() => setType(c.key)}
            />
          ))}
        </View>
        <View style={{ height: Tokens.space.sm }} />
        <View style={styles.chipsRow}>
          {serviceChips.map((c) => (
            <PrimaryButton
              key={c.key}
              title={c.label}
              variant={service === c.key ? "primary" : "ghost"}
              onPress={() => setService(c.key)}
            />
          ))}
        </View>

        <View style={{ height: Tokens.space.md }} />
        <PrimaryButton title={loading ? "Recherche..." : "Rechercher"} onPress={run} />
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

      {items.map((it) => {
        const critical = (it.critical_hours_days || []).length > 0;
        const urlRisk = it.official_url_verdict?.risk_level as string | undefined;
        const urlBadge =
          urlRisk === "high" ? { text: "URL: risque élevé", tone: "danger" as const } : urlRisk === "medium" ? { text: "URL: vigilance", tone: "warning" as const } : { text: "URL: plutôt ok", tone: "success" as const };

        return (
          <View key={it.id} style={{ marginBottom: Tokens.space.md }}>
            <GlassCard>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{it.name || "Office"}</Text>
                  <Text style={styles.meta}>
                    {it.type?.toUpperCase?.() || it.type} · {it.city}, {it.country}
                  </Text>
                </View>
                <Badge text={critical ? "Horaires critiques" : "Horaires"} tone={critical ? "warning" : "neutral"} />
              </View>

              <View style={{ height: Tokens.space.sm }} />
              <Text style={styles.body}>{it.address}</Text>

              <View style={{ height: Tokens.space.sm }} />
              <View style={styles.badgesRow}>
                {it.services?.slice(0, 4).map((s) => (
                  <Badge key={s} text={s} tone="neutral" />
                ))}
                {it.official_url ? <Badge text={urlBadge.text} tone={urlBadge.tone} /> : null}
              </View>

              <View style={{ height: Tokens.space.md }} />
              {it.hours?.length ? (
                <View style={{ gap: 6 }}>
                  {it.hours.slice(0, 5).map((h) => (
                    <Text key={`${it.id}-${h.day}-${h.open}-${h.close}`} style={styles.hour}>
                      {h.day.toUpperCase()} · {h.open || "—"} - {h.close || "—"} {h.note ? `· ${h.note}` : ""}
                    </Text>
                  ))}
                </View>
              ) : (
                <Text style={styles.hour}>Horaires non fournis (vérifier sur le site officiel).</Text>
              )}

              <View style={{ height: Tokens.space.md }} />
              <View style={styles.actionsRow}>
                <PrimaryButton title="Itinéraire" variant="ghost" onPress={() => Linking.openURL(mapsDirectionsUrl(it))} />
                <PrimaryButton title="Contacter" variant="ghost" onPress={() => openContact(it)} />
                {it.official_url ? (
                  <PrimaryButton title="Site officiel" variant="ghost" onPress={() => Linking.openURL(it.official_url)} />
                ) : null}
              </View>

              {it.disclaimer ? (
                <>
                  <View style={{ height: Tokens.space.sm }} />
                  <Text style={styles.disclaimer}>{it.disclaimer}</Text>
                </>
              ) : null}
            </GlassCard>
          </View>
        );
      })}

      {!loading && items.length === 0 ? (
        <GlassCard>
          <Text style={styles.cardTitle}>Aucun résultat</Text>
          <Text style={styles.body}>Essayez un autre pays/ville, ou laissez les filtres vides et utilisez la recherche.</Text>
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
  hour: { color: Colors.muted, fontSize: Tokens.font.size.sm, lineHeight: 20 },
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
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  rowBetween: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
});

