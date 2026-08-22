import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CounterPill } from '@/components/menu/counter-pill';
import { LegalText } from '@/components/menu/legal-text';
import { MenuButton } from '@/components/menu/menu-button';
import { MenuTile } from '@/components/menu/menu-tile';
import { SwampBackground } from '@/components/menu/swamp-background';
import { DailyBonusModal } from '@/components/modal/daily-bonus-modal';
import { Menu } from '@/constants/theme';
import { useEconomy } from '@/state/economy';

export default function Index() {
  const router = useRouter();
  const { coins } = useEconomy();
  const [showDailyBonus, setShowDailyBonus] = useState(false);

  return (
    <SwampBackground>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.topRow}>
          <View style={styles.pills}>
            <CounterPill icon={require('@/assets/images/menu/icon-coin.webp')} value={String(coins)} />
            <CounterPill icon={require('@/assets/images/menu/icon-blu.webp')} value="1" />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => router.push('/settings')}>
            <Image
              source={require('@/assets/images/menu/icon-gear.webp')}
              style={styles.gear}
              contentFit="contain"
            />
          </Pressable>
        </View>

        <Image
          source={require('@/assets/images/menu/badge-video.webp')}
          style={styles.videoBadge}
          contentFit="contain"
        />

        <View style={styles.logoSlot}>
          <View style={styles.logoBox}>
            <Image
              source={require('@/assets/images/menu/logo.webp')}
              style={styles.logo}
              contentFit="contain"
            />
          </View>
        </View>

        <View style={styles.actions}>
          <View >
            <MenuButton label="Play" onPress={() => router.push('/game')} />
            <MenuButton
              label="Arsenal"
              locked
              hint="Find a Blu to lock"
              hintIcon={require('@/assets/images/menu/icon-blu.webp')}
            />
            <MenuButton
              label="Frogenetics"
              locked
              hint="Find a Eye at 5 meters"
              hintIcon={require('@/assets/images/menu/icon-eye.webp')}
            />
          </View>

          <View style={styles.tileRow}>
            <MenuTile
              icon={require('@/assets/images/menu/icon-wheel.webp')}
              label="Wheel of Luck"
              onPress={() => router.push('/wheel')}
            />
            <MenuTile
              icon={require('@/assets/images/menu/icon-gift.webp')}
              label="Daily Rewards"
              onPress={() => setShowDailyBonus(true)}
            />
            <MenuTile
              icon={require('@/assets/images/menu/icon-podium.webp')}
              label="Leaderboards"
              onPress={() => router.push('/leaderboard')}
            />
          </View>
        </View>

        <LegalText />
      </SafeAreaView>

      <DailyBonusModal visible={showDailyBonus} onClose={() => setShowDailyBonus(false)} />
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
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  pills: {
    flexDirection: 'row',
    gap: 24,
  },
  gear: {
    width: 36,
    height: 36,
  },
  videoBadge: {
    width: 80,
    height: 35,
    alignSelf: 'flex-end',
  },
  logoSlot: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Capped at the design's native size but free to shrink with logoSlot, so a
  // squeezed layout never lets the logo overflow into the buttons below it.
  logoBox: {
    width: '100%',
    height: '100%',
    maxWidth: 278,
    maxHeight: 174,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  actions: {
    gap: 4,
  },
  tileRow: {
    flexDirection: 'row',
    gap: 8,
  },
});
