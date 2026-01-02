import React, { useMemo } from "react";
import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";

export function PrimaryButton({
  title,
  onPress,
  style,
  variant = "brand",
}: {
  title: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  variant?: "brand" | "danger" | "ghost";
}) {
  const bg = useMemo(() => {
    if (variant === "danger") return Colors.danger;
    if (variant === "ghost") return "rgba(16,22,47,0.06)";
    return Colors.brandA;
  }, [variant]);

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: variant === "brand" ? "transparent" : bg, opacity: pressed ? 0.85 : 1 },
        variant === "ghost" ? styles.ghost : null,
        style,
      ]}
    >
      {variant === "brand" ? (
        <LinearGradient
          colors={[Colors.brandA, Colors.brandB]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: Tokens.radius.lg,
    paddingVertical: Tokens.space.md,
    paddingHorizontal: Tokens.space.lg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  ghost: {
    borderWidth: 1,
    borderColor: Colors.border,
  },
  text: {
    color: Colors.text,
    fontSize: Tokens.font.size.md,
    fontWeight: Tokens.font.weight.semibold,
    letterSpacing: 0.2,
  },
});

