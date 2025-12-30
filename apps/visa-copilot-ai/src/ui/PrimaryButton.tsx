import React, { useMemo } from "react";
import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";

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
    if (variant === "ghost") return "rgba(255,255,255,0.10)";
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
        { backgroundColor: bg, opacity: pressed ? 0.85 : 1 },
        variant === "ghost" ? styles.ghost : null,
        style,
      ]}
    >
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

