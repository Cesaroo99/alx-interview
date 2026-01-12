import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useColors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";

export function GlassCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return (
    <LinearGradient
      colors={[colors.card, colors.card2]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, { borderColor: colors.border }, style]}
    >
      <View style={[styles.innerGlow, { backgroundColor: "rgba(53,230,255,0.12)" }]} />
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Tokens.radius.lg,
    padding: Tokens.space.lg,
    overflow: "hidden",
    ...(Tokens.shadow.soft as any),
  },
  innerGlow: {
    position: "absolute",
    left: -40,
    top: -40,
    width: 180,
    height: 180,
    borderRadius: 999,
  },
});

