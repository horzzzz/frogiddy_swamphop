import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FrogeneticsCard } from '@/components/frogenetics/frogenetics-card';
import { SwampBackground } from '@/components/menu/swamp-background';
import { TopBar } from '@/components/top-bar';
import { FROGENETICS_UPGRADES } from '@/constants/frogenetics';
import { Menu } from '@/constants/theme';

export default function Frogenetics() {
  const router = useRouter();

  return (
    <SwampBackground>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.topBarInset}>
          <TopBar title="Frogenetics" onBack={() => router.back()} />
        </View>

        <View style={styles.panel}>
          <Image
            source={require('@/assets/images/frames/vine-frame.png')}
            style={StyleSheet.absoluteFill}
            contentFit="fill"
          />
          <View style={styles.panelContent}>
            <Image
              source={require('@/assets/images/frogenetics/hero.webp')}
              style={styles.hero}
              contentFit="cover"
            />
            <View style={styles.cards}>
              {FROGENETICS_UPGRADES.map((upgrade) => (
                <FrogeneticsCard key={upgrade.id} upgrade={upgrade} />
              ))}
            </View>
          </View>
        </View>
      </SafeAreaView>
    </SwampBackground>
  );
}

/**
 * The vine-frame art has real border/foliage baked into the image, not a
 * safe transparent inset — this padding was measured against the pixels of
 * vine-frame.png so cards and the hero image sit inside the dark panel
 * instead of drawing over the vines.
 */
const FRAME_INSET_H = 36;
const FRAME_INSET_TOP = 40;
const FRAME_INSET_BOTTOM = 32;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: Menu.frameWidth,
    alignSelf: 'center',
  },
  topBarInset: {
    paddingHorizontal: 16,
  },
  panel: {
    flex: 1,
    marginBottom: 16,
    borderRadius: 15,
    overflow: 'hidden',
  },
  panelContent: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: FRAME_INSET_H,
    paddingTop: FRAME_INSET_TOP,
    paddingBottom: FRAME_INSET_BOTTOM,
    gap: 16,
  },
  hero: {
    width: 243,
    height: 243,
    borderRadius: 15,
    top: 8
  },
  cards: {
    flex: 1,
    width: '100%',
    gap: 8,
    top: 16,
  },
});
