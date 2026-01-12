import React, { useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { useColors } from "@/src/theme/colors";

export function ScoreBar({
  value01,
  kind = "readiness",
}: {
  value01: number; // 0..1
  kind?: "readiness" | "risk";
}) {
  const colors = useColors();
  const tint = useMemo(() => {
    if (kind === "risk") {
      if (value01 >= 0.65) return colors.danger;
      if (value01 >= 0.4) return colors.warning;
      return colors.success;
    }
    if (value01 >= 0.75) return colors.success;
    if (value01 >= 0.55) return colors.warning;
    return colors.danger;
  }, [colors.danger, colors.success, colors.warning, kind, value01]);

  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: Math.max(0, Math.min(1, value01)),
      useNativeDriver: false,
      friction: 14,
      tension: 90,
    }).start();
  }, [anim, value01]);

  const width = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={[styles.track, { borderColor: colors.border, backgroundColor: "rgba(127,127,127,0.14)" }]}>
      <Animated.View style={[styles.fill, { backgroundColor: tint, width }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1,
  },
  fill: {
    height: "100%",
    borderRadius: 999,
  },
});

