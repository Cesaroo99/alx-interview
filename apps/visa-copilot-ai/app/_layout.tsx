import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { DocumentsProvider } from "@/src/state/documents";
import { ProfileProvider } from '@/src/state/profile';
import { RemindersProvider } from "@/src/state/reminders";
import { InsightsProvider } from "@/src/state/insights";
import { VisaTimelineProvider } from "@/src/state/visa_timeline";
import { AppShell } from "@/src/ui/AppShell";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ProfileProvider>
      <DocumentsProvider>
        <RemindersProvider>
          <InsightsProvider>
            <VisaTimelineProvider>
              <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                <AppShell>
                  <Stack>
                    <Stack.Screen name="index" options={{ headerShown: false }} />
                    <Stack.Screen name="onboarding" options={{ headerShown: false }} />
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="documents/add" options={{ presentation: "modal", headerShown: false }} />
                    <Stack.Screen name="documents/edit" options={{ presentation: "modal", headerShown: false }} />
                    <Stack.Screen name="portal" options={{ presentation: "modal", headerShown: false }} />
                    <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
                  </Stack>
                </AppShell>
              </ThemeProvider>
            </VisaTimelineProvider>
          </InsightsProvider>
        </RemindersProvider>
      </DocumentsProvider>
    </ProfileProvider>
  );
}
