import React from "react";
import { Slot } from "expo-router";

// Le layout "Tabs" a été remplacé par un shell (sidebar + contexte).
// Ici, on rend simplement les écrans de ce groupe.
export default function AppGroupLayout() {
  return <Slot />;
}
