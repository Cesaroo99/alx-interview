import React, { useMemo } from "react";
import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import { useColors } from "@/src/theme/colors";
import { useTypeScale } from "@/src/theme/typography";
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
  const colors = useColors();
  const type = useTypeScale();
  const bg = useMemo(() => {
    if (variant === "danger") return colors.danger;
    if (variant === "ghost") return "rgba(127,127,127,0.12)";
    return colors.brandA;
  }, [colors.brandA, colors.danger, variant]);

  const fg = useMemo(() => {
    if (variant === "brand") return colors.onBrand;
    return colors.text;
  }, [colors.onBrand, colors.text, variant]);

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: variant === "brand" ? "transparent" : bg, opacity: pressed ? 0.85 : 1 },
        variant === "ghost" ? [styles.ghost, { borderColor: colors.border }] : null,
        style,
      ]}
    >
      {variant === "brand" ? (
        <LinearGradient
          colors={[colors.brandA, colors.brandB]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <Text style={[styles.text, type.bodyStrong, { color: fg }]}>{title}</Text>
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
  },
  text: {
    letterSpacing: 0.2,
    textAlign: "center",
    flexShrink: 1,
  },
});

