import React, { useEffect } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useColors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";

export function SkeletonLine({
  width = "100%",
  height = 14,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const p = useSharedValue(0.4);

  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [p]);

  const aStyle = useAnimatedStyle(() => ({ opacity: p.value }));

  return <Animated.View style={[styles.line, { width, height, backgroundColor: colors.skeleton }, aStyle, style]} />;
}

export function SkeletonCard() {
  const colors = useColors();
  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <SkeletonLine width="55%" />
      <View style={{ height: Tokens.space.md }} />
      <SkeletonLine />
      <View style={{ height: Tokens.space.sm }} />
      <SkeletonLine width="90%" />
      <View style={{ height: Tokens.space.sm }} />
      <SkeletonLine width="72%" />
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    borderRadius: 999,
  },
  card: {
    borderRadius: Tokens.radius.lg,
    borderWidth: 1,
    padding: Tokens.space.lg,
  },
});

