import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { Api } from "@/src/api/client";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GlassCard } from "@/src/ui/GlassCard";
import { HeroBanner } from "@/src/ui/HeroBanner";
import { Screen } from "@/src/ui/Screen";

export default function ProcedureAudit() {
  const { procedureId } = useLocalSearchParams<{ procedureId: string }>();
  const pid = String(procedureId || "");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await Api.audit({ procedure_id: pid, limit: 200 });
        if (!cancelled) setItems(res.items || []);
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pid]);

  return (
    <Screen>
      <HeroBanner kicker="Trace" title="Audit" subtitle={pid} />

      <GlassCard>
        <View style={styles.rowTop}>
          <Text style={styles.cardTitle}>Événements</Text>
          {loading ? <ActivityIndicator /> : null}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={{ height: Tokens.space.sm }} />
        {items.length ? (
          items.slice(0, 50).map((e) => (
            <View key={e.id} style={styles.eventRow}>
              <Text style={styles.eventTitle}>
                {e.action} · {e.actor}
              </Text>
              <Text style={styles.eventMeta}>{e.created_at}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.body}>Aucun événement pour l’instant.</Text>
        )}
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { color: Colors.text, fontSize: Tokens.font.size.lg, fontWeight: Tokens.font.weight.bold },
  body: { marginTop: Tokens.space.sm, color: Colors.muted, fontSize: Tokens.font.size.md, lineHeight: 22 },
  error: { marginTop: Tokens.space.sm, color: Colors.warning, fontSize: Tokens.font.size.md, lineHeight: 22 },
  eventRow: { marginTop: Tokens.space.md },
  eventTitle: { color: Colors.text, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.bold },
  eventMeta: { marginTop: 4, color: Colors.faint, fontSize: Tokens.font.size.sm },
});

