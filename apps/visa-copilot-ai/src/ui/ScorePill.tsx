import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";

export function ScorePill({
  label,
  value,
  kind = "readiness",
}: {
  label: string;
  value: number;
  kind?: "readiness" | "risk";
}) {
  const { tint, text } = useMemo(() => {
    if (kind === "risk") {
      if (value >= 0.65) return { tint: Colors.danger, text: "Risque élevé" };
      if (value >= 0.4) return { tint: Colors.warning, text: "Risque moyen" };
      return { tint: Colors.success, text: "Risque faible" };
    }
    if (value >= 75) return { tint: Colors.success, text: "Prêt (fort)" };
    if (value >= 55) return { tint: Colors.warning, text: "Presque prêt" };
    return { tint: Colors.danger, text: "Pas prêt" };
  }, [kind, value]);

  return (
    <View style={[styles.pill, { borderColor: `${tint}55` }]}>
      <View style={[styles.dot, { backgroundColor: tint }]} />
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>
        {kind === "risk" ? `${Math.round(value * 100)}%` : `${Math.round(value)}/100`}
      </Text>
      <Text style={styles.state}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: Tokens.space.sm,
    paddingHorizontal: Tokens.space.md,
    borderRadius: Tokens.radius.xl,
    borderWidth: 1,
    backgroundColor: Colors.card,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 99,
  },
  label: {
    color: Colors.muted,
    fontSize: Tokens.font.size.sm,
    fontWeight: Tokens.font.weight.medium,
  },
  value: {
    color: Colors.text,
    fontSize: Tokens.font.size.sm,
    fontWeight: Tokens.font.weight.bold,
    marginLeft: "auto",
  },
  state: {
    color: Colors.faint,
    fontSize: Tokens.font.size.sm,
    fontWeight: Tokens.font.weight.medium,
  },
});

