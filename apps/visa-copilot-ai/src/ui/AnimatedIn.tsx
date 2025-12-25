import React from "react";
import { StyleProp, ViewStyle } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

export function AnimatedIn({
  children,
  style,
  delayMs = 0,
  direction = "down",
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delayMs?: number;
  direction?: "down" | "up";
}) {
  const entering =
    direction === "up" ? FadeInUp.delay(delayMs).springify() : FadeInDown.delay(delayMs).springify();

  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}

