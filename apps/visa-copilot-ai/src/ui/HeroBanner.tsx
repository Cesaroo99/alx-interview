import React from "react";
import { Image, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useColors } from "@/src/theme/colors";
import { useColorScheme } from "@/components/useColorScheme";
import { Tokens } from "@/src/theme/tokens";
import { useTypeScale } from "@/src/theme/typography";

export function HeroBanner({
  kicker,
  title,
  subtitle,
  style,
}: {
  kicker: string;
  title: string;
  subtitle: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const scheme = useColorScheme();
  const type = useTypeScale();
  return (
    <View style={[styles.root, style]}>
      <LinearGradient
        colors={
          scheme === "dark"
            ? ["rgba(124,92,255,0.26)", "rgba(53,230,255,0.18)", "rgba(255,77,255,0.14)"]
            : ["rgba(124,92,255,0.22)", "rgba(53,230,255,0.18)", "rgba(255,77,255,0.14)"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.banner, { borderColor: colors.border }]}
      >
        <View style={styles.left}>
          <Text style={[styles.kicker, type.caption, { color: colors.brandB }]}>{kicker}</Text>
          <Text style={[styles.title, type.h1, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.subtitle, type.body, { color: colors.muted }]}>{subtitle}</Text>
        </View>
        <View style={styles.right}>
          <View style={[styles.logoWrap, { borderColor: colors.border, backgroundColor: scheme === "dark" ? "rgba(12,16,38,0.55)" : "rgba(255,255,255,0.55)" }]}>
            <Image source={require("../../assets/images/icon.png")} style={styles.logo} />
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Tokens.space.md },
  banner: {
    borderRadius: Tokens.radius.xl,
    padding: Tokens.space.xl,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: { flex: 1, paddingRight: Tokens.space.lg, gap: 8 },
  right: { width: 88, alignItems: "flex-end" },
  logoWrap: {
    width: 76,
    height: 76,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: 56, height: 56, resizeMode: "contain" },
  kicker: { letterSpacing: 1, textTransform: "uppercase" },
  title: {},
  subtitle: {},
});

