import React, { useMemo } from "react";
import { StyleProp, Text, TextStyle } from "react-native";

import { useColors } from "@/src/theme/colors";
import { useTypeScale } from "@/src/theme/typography";

export type AppTextVariant = "h1" | "h2" | "h3" | "body" | "bodyStrong" | "caption";
export type AppTextTone = "default" | "muted" | "faint" | "brand" | "success" | "warning" | "danger";

export function AppText({
  children,
  variant = "body",
  tone = "default",
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  variant?: AppTextVariant;
  tone?: AppTextTone;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const colors = useColors();
  const type = useTypeScale();

  const base = variant === "h1" ? type.h1 : variant === "h2" ? type.h2 : variant === "h3" ? type.h3 : variant === "caption" ? type.caption : variant === "bodyStrong" ? type.bodyStrong : type.body;

  const color = useMemo(() => {
    if (tone === "muted") return colors.muted;
    if (tone === "faint") return colors.faint;
    if (tone === "brand") return colors.brandA;
    if (tone === "success") return colors.success;
    if (tone === "warning") return colors.warning;
    if (tone === "danger") return colors.danger;
    return colors.text;
  }, [colors, tone]);

  return (
    <Text numberOfLines={numberOfLines} style={[base as any, { color }, style]}>
      {children}
    </Text>
  );
}

