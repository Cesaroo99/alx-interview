import React from "react";
import { Image, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";

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
  return (
    <View style={[styles.root, style]}>
      <LinearGradient
        colors={["rgba(124,92,255,0.35)", "rgba(53,230,255,0.18)", "rgba(255,77,255,0.12)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.banner}
      >
        <View style={styles.left}>
          <Text style={styles.kicker}>{kicker}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <View style={styles.right}>
          <View style={styles.logoWrap}>
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
    borderColor: "rgba(255,255,255,0.12)",
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
    backgroundColor: "rgba(6,8,20,0.50)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: 56, height: 56, resizeMode: "contain" },
  kicker: {
    color: Colors.brandB,
    fontWeight: Tokens.font.weight.semibold,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontSize: Tokens.font.size.xs,
  },
  title: {
    color: Colors.text,
    fontSize: Tokens.font.size.hero,
    fontWeight: Tokens.font.weight.black,
    lineHeight: 38,
  },
  subtitle: {
    color: Colors.muted,
    fontSize: Tokens.font.size.md,
    lineHeight: 22,
  },
});

