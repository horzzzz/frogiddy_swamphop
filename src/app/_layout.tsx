import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LoadingScreen } from '@/components/loading-screen';
import { initAds } from '@/services/ads';
import { initAnalytics } from '@/services/analytics';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initAnalytics();
    initAds();
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const handleLoadingDone = useCallback(() => setLoading(false), []);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        {loading ? (
          <LoadingScreen onDone={handleLoadingDone} />
        ) : (
          <Stack screenOptions={{ headerShown: false }} />
        )}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
