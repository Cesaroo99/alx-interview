import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/src/theme/colors";
import { useTypeScale } from "@/src/theme/typography";
import { Tokens } from "@/src/theme/tokens";

export function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const colors = useColors();
  const type = useTypeScale();
  const tint =
    tone === "success" ? colors.success : tone === "warning" ? colors.warning : tone === "danger" ? colors.danger : colors.faint;
  return (
    <View style={[styles.badge, { borderColor: `${tint}55`, backgroundColor: `${tint}14` }]}>
      <Text style={[styles.text, type.caption, { color: colors.text }]}>{label}</Text>
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
    // size/weight from type scale
  },
});

