import React from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useColors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GradientBackground } from "@/src/ui/GradientBackground";

export function Screen({
  children,
  scroll = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
}) {
  const colors = useColors();
  const content = (
    <View style={styles.content}>
      {children}
      <View style={{ height: Tokens.space.xxl }} />
    </View>
  );

  return (
    <GradientBackground>
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={["top", "left", "right", "bottom"]}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={Platform.OS === "web"}
          >
            {content}
          </ScrollView>
        ) : (
          content
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scroll: {
    padding: Tokens.space.xl,
  },
  content: {
    gap: Tokens.space.lg,
  },
});

