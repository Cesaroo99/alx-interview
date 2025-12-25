import React, { useEffect } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Colors } from "@/src/theme/colors";
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
  const p = useSharedValue(0.4);

  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [p]);

  const aStyle = useAnimatedStyle(() => ({ opacity: p.value }));

  return <Animated.View style={[styles.line, { width, height }, aStyle, style]} />;
}

export function SkeletonCard() {
  return (
    <View style={styles.card}>
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
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  card: {
    borderRadius: Tokens.radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    padding: Tokens.space.lg,
  },
});

