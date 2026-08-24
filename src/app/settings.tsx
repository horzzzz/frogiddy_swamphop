import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SwampBackground } from '@/components/menu/swamp-background';
import { SettingsCard } from '@/components/settings/settings-card';
import { SettingsLinkRow, SettingsToggleRow } from '@/components/settings/settings-row';
import { TopBar } from '@/components/top-bar';
import { Menu } from '@/constants/theme';
import { reportEvent } from '@/services/analytics';

/**
 * Nothing here is wired to real audio/haptics/push systems yet — the app has
 * none. Toggles hold local state so the screen is fully interactive, but they
 * are stubs until those systems exist.
 */
export default function Settings() {
  const router = useRouter();
  const [musicOn, setMusicOn] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [vibrationOn, setVibrationOn] = useState(true);
  const [notificationsOn, setNotificationsOn] = useState(false);

  useEffect(() => {
    reportEvent('settings', { action: 'open' });
  }, []);

  return (
    <SwampBackground>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <TopBar title="Settings" onBack={() => router.back()} />

        <View style={styles.panel}>
          <Image
            source={require('@/assets/images/frames/vine-frame.png')}
            style={StyleSheet.absoluteFill}
            contentFit="fill"
          />
          <View style={styles.panelContent}>
            <SettingsCard>
              <SettingsToggleRow label="Music" value={musicOn} onValueChange={setMusicOn} />
              <SettingsToggleRow label="Sound" value={soundOn} onValueChange={setSoundOn} />
            </SettingsCard>

            <SettingsCard>
              <SettingsToggleRow label="Vibration" value={vibrationOn} onValueChange={setVibrationOn} />
              <SettingsToggleRow
                label="Notifications"
                value={notificationsOn}
                onValueChange={setNotificationsOn}
              />
            </SettingsCard>

            <SettingsCard>
              <SettingsLinkRow
                label="Privacy Policy"
                onPress={() => Linking.openURL('https://telegra.ph/PRIVACY-POLICY-08-24-121')}
              />
              <SettingsLinkRow
                label="Terms Of Use"
                onPress={() => Linking.openURL('https://telegra.ph/TERMS-OF-USE-08-24-10')}
              />
            </SettingsCard>
          </View>
        </View>
      </SafeAreaView>
    </SwampBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: Menu.frameWidth,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  panel: {
    marginTop: 12,
    borderRadius: 24,
    overflow: 'hidden',
  },
  panelContent: {
    paddingHorizontal: 40,
    paddingVertical: 44,
    gap: 16,
  },
});
