import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";

export function GlassCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <LinearGradient
      colors={[Colors.card, Colors.card2]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, style]}
    >
      <View style={styles.innerGlow} />
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: Colors.border,
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
    backgroundColor: "rgba(53,230,255,0.12)",
  },
});

