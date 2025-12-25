import React, { useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { Colors } from "@/src/theme/colors";

export function ScoreBar({
  value01,
  kind = "readiness",
}: {
  value01: number; // 0..1
  kind?: "readiness" | "risk";
}) {
  const tint = useMemo(() => {
    if (kind === "risk") {
      if (value01 >= 0.65) return Colors.danger;
      if (value01 >= 0.4) return Colors.warning;
      return Colors.success;
    }
    if (value01 >= 0.75) return Colors.success;
    if (value01 >= 0.55) return Colors.warning;
    return Colors.danger;
  }, [kind, value01]);

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
    <View style={styles.track}>
      <Animated.View style={[styles.fill, { backgroundColor: tint, width }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fill: {
    height: "100%",
    borderRadius: 999,
  },
});

