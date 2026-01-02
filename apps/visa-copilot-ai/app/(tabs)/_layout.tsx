import React from "react";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Tabs } from "expo-router";

import { useClientOnlyValue } from "@/components/useClientOnlyValue";
import { Colors } from "@/src/theme/colors";

// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>["name"];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.brandB,
        tabBarInactiveTintColor: "rgba(245,247,255,0.60)",
        tabBarStyle: {
          backgroundColor: "rgba(6,8,20,0.94)",
          borderTopColor: "rgba(255,255,255,0.10)",
        },
        // Disable static header on web to prevent hydration error
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: "Accueil",
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="parcours"
        options={{
          title: "Parcours",
          tabBarIcon: ({ color }) => <TabBarIcon name="map-signs" color={color} />,
        }}
      />
      <Tabs.Screen
        name="dossier"
        options={{
          title: "Dossier",
          tabBarIcon: ({ color }) => <TabBarIcon name="check-circle" color={color} />,
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          title: "Docs",
          tabBarIcon: ({ color }) => <TabBarIcon name="file-text" color={color} />,
        }}
      />
      <Tabs.Screen
        name="copilot"
        options={{
          title: "Copilot",
          tabBarIcon: ({ color }) => <TabBarIcon name="comments" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tools"
        options={{
          title: "Outils",
          tabBarIcon: ({ color }) => <TabBarIcon name="magic" color={color} />,
        }}
      />

      {/* Écrans existants conservés, mais retirés de la barre d’onglets (accès via CTA / parcours). */}
      <Tabs.Screen name="diagnostic" options={{ href: null }} />
      <Tabs.Screen name="security" options={{ href: null }} />
      <Tabs.Screen name="appointments" options={{ href: null }} />
      <Tabs.Screen name="billing" options={{ href: null }} />
      <Tabs.Screen name="eligibility" options={{ href: null }} />
      <Tabs.Screen name="offices" options={{ href: null }} />
      <Tabs.Screen name="news" options={{ href: null }} />
      <Tabs.Screen name="admin_rules" options={{ href: null }} />
    </Tabs>
  );
}
