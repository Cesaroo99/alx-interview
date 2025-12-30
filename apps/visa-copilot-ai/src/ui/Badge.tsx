import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";

export function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const tint =
    tone === "success" ? Colors.success : tone === "warning" ? Colors.warning : tone === "danger" ? Colors.danger : Colors.faint;
  return (
    <View style={[styles.badge, { borderColor: `${tint}55`, backgroundColor: `${tint}14` }]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  text: {
    color: Colors.text,
    fontSize: Tokens.font.size.xs,
    fontWeight: Tokens.font.weight.semibold,
  },
});

