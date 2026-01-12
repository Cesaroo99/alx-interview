import React from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useColors } from "@/src/theme/colors";
import { useColorScheme } from "@/components/useColorScheme";

export function GradientBackground({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const scheme = useColorScheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <LinearGradient
        colors={[colors.bg, colors.bg3, colors.bg2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={
          scheme === "dark"
            ? ["rgba(124,92,255,0.26)", "rgba(53,230,255,0.18)", "rgba(255,77,255,0.14)"]
            : ["rgba(124,92,255,0.22)", "rgba(53,230,255,0.16)", "rgba(255,77,255,0.12)"]
        }
        start={{ x: 0.1, y: 0.1 }}
        end={{ x: 0.9, y: 0.9 }}
        style={[StyleSheet.absoluteFill, { opacity: scheme === "dark" ? 0.55 : 0.75 }]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

