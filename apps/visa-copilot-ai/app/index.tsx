import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { useProfile } from "@/src/state/profile";
import { Colors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { GradientBackground } from "@/src/ui/GradientBackground";

export default function Entry() {
  const { loaded, profile } = useProfile();

  useEffect(() => {
    if (!loaded) return;
    if (profile) router.replace("/(tabs)");
    else router.replace("/onboarding");
  }, [loaded, profile]);

  return (
    <GradientBackground>
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.text}>Chargement…</Text>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: Tokens.space.sm },
  text: { color: Colors.muted, fontSize: Tokens.font.size.md, fontWeight: Tokens.font.weight.medium },
});

