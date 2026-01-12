import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { useColors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { AppText } from "@/src/ui/AppText";

export function ScorePill({
  label,
  value,
  kind = "readiness",
}: {
  label: string;
  value: number;
  kind?: "readiness" | "risk";
}) {
  const colors = useColors();
  const { tint, text } = useMemo(() => {
    if (kind === "risk") {
      if (value >= 0.65) return { tint: colors.danger, text: "Risque élevé" };
      if (value >= 0.4) return { tint: colors.warning, text: "Risque moyen" };
      return { tint: colors.success, text: "Risque faible" };
    }
    if (value >= 75) return { tint: colors.success, text: "Prêt (fort)" };
    if (value >= 55) return { tint: colors.warning, text: "Presque prêt" };
    return { tint: colors.danger, text: "Pas prêt" };
  }, [colors.danger, colors.success, colors.warning, kind, value]);

  return (
    <View style={[styles.pill, { borderColor: `${tint}55`, backgroundColor: colors.card }]}>
      <View style={[styles.dot, { backgroundColor: tint }]} />
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      <AppText variant="caption" tone="default" style={styles.value}>
        {kind === "risk" ? `${Math.round(value * 100)}%` : `${Math.round(value)}/100`}
      </AppText>
      <AppText variant="caption" tone="faint">
        {text}
      </AppText>
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
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 99,
  },
  value: {
    marginLeft: "auto",
  },
});

