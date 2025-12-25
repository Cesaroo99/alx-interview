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
          backgroundColor: "rgba(7,10,18,0.92)",
          borderTopColor: "rgba(255,255,255,0.10)",
        },
        headerShown: false,
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
        name="diagnostic"
        options={{
          title: "Diagnostic",
          tabBarIcon: ({ color }) => <TabBarIcon name="stethoscope" color={color} />,
        }}
      />
      <Tabs.Screen
        name="security"
        options={{
          title: "Sécurité",
          tabBarIcon: ({ color }) => <TabBarIcon name="shield" color={color} />,
        }}
      />
      <Tabs.Screen
        name="dossier"
        options={{
          title: "Dossier",
          tabBarIcon: ({ color }) => <TabBarIcon name="folder-open" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tools"
        options={{
          title: "Outils",
          tabBarIcon: ({ color }) => <TabBarIcon name="magic" color={color} />,
        }}
      />
    </Tabs>
  );
}
