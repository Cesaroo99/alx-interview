import React from "react";
import { StyleSheet, View } from "react-native";

import { useColors } from "@/src/theme/colors";

export function ProgressBar({ step, total }: { step: number; total: number }) {
  const colors = useColors();
  const value = Math.max(0, Math.min(1, total > 0 ? step / total : 0));
  return (
    <View style={[styles.track, { borderColor: colors.border, backgroundColor: "rgba(127,127,127,0.14)" }]}>
      <View style={[styles.fill, { width: `${Math.round(value * 100)}%`, backgroundColor: colors.brandB }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1,
  },
  fill: {
    height: "100%",
    borderRadius: 999,
  },
});

