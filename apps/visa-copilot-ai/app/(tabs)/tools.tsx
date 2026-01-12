import React, { useMemo } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";

import { useColors } from "@/src/theme/colors";
import { Tokens } from "@/src/theme/tokens";
import { AppText } from "@/src/ui/AppText";
import { GlassCard } from "@/src/ui/GlassCard";
import { HeroBanner } from "@/src/ui/HeroBanner";
import { PrimaryButton } from "@/src/ui/PrimaryButton";
import { Screen } from "@/src/ui/Screen";

export default function ToolsScreen() {
  const { width } = useWindowDimensions();
  const isMobile = width < 720;
  const colors = useColors();

  const btnCellStyle = useMemo(() => {
    // Sur mobile: évite les boutons trop petits (texte coupé) en forçant des largeurs lisibles.
    if (isMobile) return { width: "100%" as const };
    return styles.btnCell;
  }, [isMobile]);

  return (
    <Screen>
      <HeroBanner
        kicker="Boîte à outils"
        title="Outils"
        subtitle="Plan, coûts, sécurité… tout ce qu’il faut pour rendre ton dossier cohérent."
      />

      <GlassCard>
        <AppText variant="h3">Préparer le dossier (priorité)</AppText>
        <AppText tone="muted" style={styles.body}>
          Les 3 actions qui améliorent le plus vite la cohérence: itinéraire, budget, corrections.
        </AppText>
        <View style={{ height: Tokens.space.md }} />
        <View style={styles.rowButtons}>
          <PrimaryButton title="Itinéraire" variant="ghost" onPress={() => router.push("/tools/travel")} style={btnCellStyle} />
          <PrimaryButton title="Coûts" variant="ghost" onPress={() => router.push("/tools/costs")} style={btnCellStyle} />
          <PrimaryButton title="Portails" variant="ghost" onPress={() => router.push("/tools/portals")} style={btnCellStyle} />
          <PrimaryButton title="Formulaires" variant="ghost" onPress={() => router.push("/tools/forms")} style={btnCellStyle} />
          <PrimaryButton title="Procédure" variant="ghost" onPress={() => router.push("/tools/procedure_timeline")} style={btnCellStyle} />
          <PrimaryButton title="Vérif finale" variant="ghost" onPress={() => router.push("/tools/final_check")} style={btnCellStyle} />
        </View>
      </GlassCard>

      <GlassCard>
        <AppText variant="h3">Propositions de visa</AppText>
        <AppText tone="muted" style={styles.body}>
          Voir les visas potentiellement accessibles + score et pistes d’amélioration.
        </AppText>
        <View style={{ height: Tokens.space.md }} />
        <PrimaryButton title="Ouvrir" variant="ghost" onPress={() => router.push("/(tabs)/eligibility")} />
      </GlassCard>

      <GlassCard>
        <AppText variant="h3">Ambassades & consulats</AppText>
        <AppText tone="muted" style={styles.body}>
          Trouver une ambassade/consulat/TLS/VFS (liste + filtres) et ouvrir l’itinéraire.
        </AppText>
        <View style={{ height: Tokens.space.md }} />
        <PrimaryButton title="Ouvrir" variant="ghost" onPress={() => router.push("/(tabs)/offices")} />
      </GlassCard>

      <GlassCard>
        <AppText variant="h3">Actualités visa & lois</AppText>
        <AppText tone="muted" style={styles.body}>
          Flux par pays, catégories et tags (avec sources et avertissements).
        </AppText>
        <View style={{ height: Tokens.space.md }} />
        <PrimaryButton title="Ouvrir" variant="ghost" onPress={() => router.push("/(tabs)/news")} />
      </GlassCard>

      <GlassCard>
        <AppText variant="h3">Rendez-vous & rappels</AppText>
        <AppText tone="muted" style={styles.body}>
          Créer des rappels et suivre les délais.
        </AppText>
        <View style={{ height: Tokens.space.md }} />
        <PrimaryButton title="Ouvrir" variant="ghost" onPress={() => router.push("/(tabs)/appointments")} />
      </GlassCard>

      <GlassCard>
        <AppText variant="h3">Travel Intelligence (simulation)</AppText>
        <AppText tone="muted" style={styles.body}>
          Générer un itinéraire “visa‑compliant” (sans réservation) + alertes de cohérence.
        </AppText>
        <View style={{ height: Tokens.space.md }} />
        <PrimaryButton title="Ouvrir" variant="ghost" onPress={() => router.push("/tools/travel")} />
      </GlassCard>

      <GlassCard>
        <AppText variant="h3">Estimation des coûts</AppText>
        <AppText tone="muted" style={styles.body}>
          Calcule un total à partir des montants officiels + détecte des frais suspects.
        </AppText>
        <View style={{ height: Tokens.space.md }} />
        <PrimaryButton title="Ouvrir" variant="ghost" onPress={() => router.push("/tools/costs")} />
      </GlassCard>

      <GlassCard>
        <AppText variant="h3">Abonnements & paiement</AppText>
        <AppText tone="muted" style={styles.body}>
          Choisir un plan et payer via checkout (MVP).
        </AppText>
        <View style={{ height: Tokens.space.md }} />
        <PrimaryButton title="Voir les plans" variant="ghost" onPress={() => router.push("/(tabs)/billing")} />
      </GlassCard>

      {process.env.EXPO_PUBLIC_ADMIN_MODE === "1" ? (
        <GlassCard>
          <AppText variant="h3">Admin</AppText>
          <AppText tone="muted" style={styles.body}>
            Éditer les règles d’éligibilité (mode admin).
          </AppText>
          <View style={{ height: Tokens.space.md }} />
          <PrimaryButton title="Règles éligibilité" variant="ghost" onPress={() => router.push("/(tabs)/admin_rules")} />
        </GlassCard>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: {},
  body: { marginTop: Tokens.space.sm },
  rowButtons: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  btnCell: { flexGrow: 1, flexBasis: 160 },
  row: { flexDirection: "row", gap: 10, marginTop: Tokens.space.sm, alignItems: "flex-start" },
  dot: { width: 10, height: 10, borderRadius: 99, marginTop: 6 },
  text: { flex: 1 },
});

