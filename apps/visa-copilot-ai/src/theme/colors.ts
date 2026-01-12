import { useColorScheme } from "react-native";
import { useMemo } from "react";

export type AppColorScheme = "light" | "dark";

export type AppColors = {
  // Fond
  bg: string;
  bg2: string;
  bg3: string;

  // Surfaces
  card: string;
  card2: string;
  border: string;

  // Texte
  text: string;
  muted: string;
  faint: string;

  // Actions / états
  success: string;
  warning: string;
  danger: string;

  // Marque
  brandA: string;
  brandB: string;
  brandC: string;

  // Contrastes utiles
  onBrand: string;

  // UI system
  skeleton: string;

  // Navigation / chrome
  navBg: string;
  navBorder: string;
  navItemBgActive: string;
  navItemBorderActive: string;
  navItemIconInactive: string;
  navItemIconActive: string;
  navLabelInactive: string;
};

export const LightColors: AppColors = {
  // Fond (clair, “app”)
  bg: "#F6F8FF",
  bg2: "#EEF2FF",
  bg3: "#EAF7FF",

  // Surfaces (glass)
  card: "rgba(255,255,255,0.82)",
  card2: "rgba(255,255,255,0.66)",
  border: "rgba(16,22,47,0.10)",

  // Texte
  text: "#10162F",
  muted: "rgba(16,22,47,0.76)",
  faint: "rgba(16,22,47,0.58)",

  // Statuts
  success: "#2BE7A8",
  warning: "#FFB84A",
  danger: "#FF4D7D",

  // Marque (néon “premium”)
  brandA: "#7C5CFF", // violet
  brandB: "#35E6FF", // cyan
  brandC: "#FF4DFF", // magenta

  onBrand: "#FFFFFF",

  skeleton: "rgba(16,22,47,0.08)",

  navBg: "rgba(6,8,20,0.92)",
  navBorder: "rgba(255,255,255,0.08)",
  navItemBgActive: "rgba(124,92,255,0.16)",
  navItemBorderActive: "rgba(124,92,255,0.26)",
  navItemIconInactive: "rgba(245,247,255,0.72)",
  navItemIconActive: "#35E6FF",
  navLabelInactive: "rgba(245,247,255,0.78)",
};

export const DarkColors: AppColors = {
  // Fond (dark “premium”)
  bg: "#070A18",
  bg2: "#0B1030",
  bg3: "#091026",

  // Surfaces (glass)
  card: "rgba(12,16,38,0.78)",
  card2: "rgba(12,16,38,0.58)",
  border: "rgba(255,255,255,0.10)",

  // Texte
  text: "#F3F6FF",
  muted: "rgba(243,246,255,0.78)",
  faint: "rgba(243,246,255,0.58)",

  // Statuts
  success: "#2BE7A8",
  warning: "#FFB84A",
  danger: "#FF4D7D",

  // Marque
  brandA: "#8B74FF",
  brandB: "#35E6FF",
  brandC: "#FF4DFF",

  onBrand: "#0B0F22",

  skeleton: "rgba(243,246,255,0.10)",

  navBg: "rgba(8,10,24,0.96)",
  navBorder: "rgba(255,255,255,0.10)",
  navItemBgActive: "rgba(124,92,255,0.22)",
  navItemBorderActive: "rgba(124,92,255,0.34)",
  navItemIconInactive: "rgba(243,246,255,0.72)",
  navItemIconActive: "#35E6FF",
  navLabelInactive: "rgba(243,246,255,0.78)",
};

export function getColors(scheme: string | null | undefined): AppColors {
  return scheme === "dark" ? DarkColors : LightColors;
}

export function useColors(): AppColors {
  const scheme = useColorScheme();
  return useMemo(() => getColors(scheme), [scheme]);
}

// Backward compatibility (progressive migration).
// Note: pour le mode sombre, migrez vers `useColors()`.
export const Colors = LightColors;

