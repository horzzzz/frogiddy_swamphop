import { BlackHanSans_400Regular } from '@expo-google-fonts/black-han-sans';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LoadingScreen } from '@/components/loading-screen';
import { initAds } from '@/services/ads';
import { initAnalytics } from '@/services/analytics';
import { initAudio } from '@/services/audio';
import { EconomyProvider } from '@/state/economy';
import { SettingsProvider } from '@/state/settings';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loading, setLoading] = useState(true);
  const [fontsLoaded] = useFonts({ BlackHanSans_400Regular });

  useEffect(() => {
    initAnalytics();
    initAds();
    initAudio();
  }, []);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  const handleLoadingDone = useCallback(() => setLoading(false), []);

  if (!fontsLoaded) return null;

  return (
    // Required by react-native-gesture-handler; the game's slingshot Pan gesture
    // will not receive touches without it, and expo-router does not add one.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <SettingsProvider>
            <EconomyProvider>
              {loading ? (
                <LoadingScreen onDone={handleLoadingDone} />
              ) : (
                <Stack screenOptions={{ headerShown: false }} />
              )}
            </EconomyProvider>
          </SettingsProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
