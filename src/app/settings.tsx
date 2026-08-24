import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SwampBackground } from '@/components/menu/swamp-background';
import { SettingsCard } from '@/components/settings/settings-card';
import { SettingsLinkRow, SettingsToggleRow } from '@/components/settings/settings-row';
import { TopBar } from '@/components/top-bar';
import { Menu } from '@/constants/theme';
import { reportEvent } from '@/services/analytics';
import { useSettings } from '@/state/settings';

/**
 * Music and Sound drive the real audio service and are persisted. Vibration and
 * Notifications are still stubs — the app has neither haptics nor push — but
 * their positions are saved all the same, so they behave like switches rather
 * than resetting every time the screen is opened.
 */
export default function Settings() {
  const router = useRouter();
  const {
    musicOn,
    soundOn,
    vibrationOn,
    notificationsOn,
    setMusicOn,
    setSoundOn,
    setVibrationOn,
    setNotificationsOn,
  } = useSettings();

  useEffect(() => {
    reportEvent('settings', { action: 'open' });
  }, []);

  return (
    <SwampBackground>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <TopBar title="Settings" onBack={() => router.back()} />

        <View style={styles.panel}>
          <Image
            source={require('@/assets/images/frames/vine-frame.webp')}
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
              <SettingsLinkRow label="Tutorial" onPress={() => router.push('/tutorial')} />
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
