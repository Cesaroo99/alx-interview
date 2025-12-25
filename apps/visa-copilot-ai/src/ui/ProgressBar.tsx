import React from "react";
import { StyleSheet, View } from "react-native";

import { Colors } from "@/src/theme/colors";

export function ProgressBar({ step, total }: { step: number; total: number }) {
  const value = Math.max(0, Math.min(1, total > 0 ? step / total : 0));
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.round(value * 100)}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: Colors.brandB,
  },
});

