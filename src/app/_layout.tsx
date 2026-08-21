import { BlackHanSans_400Regular } from '@expo-google-fonts/black-han-sans';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LoadingScreen } from '@/components/loading-screen';
import { initAds } from '@/services/ads';
import { initAnalytics } from '@/services/analytics';
import { EconomyProvider } from '@/state/economy';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loading, setLoading] = useState(true);
  const [fontsLoaded] = useFonts({ BlackHanSans_400Regular });

  useEffect(() => {
    initAnalytics();
    initAds();
  }, []);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  const handleLoadingDone = useCallback(() => setLoading(false), []);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <EconomyProvider>
          {loading ? (
            <LoadingScreen onDone={handleLoadingDone} />
          ) : (
            <Stack screenOptions={{ headerShown: false }} />
          )}
        </EconomyProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
