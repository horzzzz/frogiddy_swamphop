import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GameHud } from '@/components/game/game-hud';
import { TutorialCard } from '@/components/tutorial/tutorial-card';
import { TutorialInfoModal } from '@/components/tutorial/tutorial-info-modal';
import { maxLivesFor } from '@/constants/frogenetics';
import { Menu } from '@/constants/theme';
import { TUTORIAL_CARDS, type TutorialCardData } from '@/constants/tutorial';
import { DESIGN_WIDTH } from '@/game/constants';
import { reportEvent } from '@/services/analytics';
import { playSfx } from '@/services/audio';
import { useEconomy } from '@/state/economy';

/**
 * Vertical space the game HUD's pill row + height plate occupy, in design units —
 * the pill row (36) plus its top padding (8) plus the height plate below it (~58).
 * `GameHud` renders absolutely and never takes part in layout, so the card rows
 * below reserve this much space themselves to avoid sitting under it.
 */
const HUD_BLOCK = 102;

export default function Tutorial() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { bestHeight, upgrades, markTutorialSeen } = useEconomy();
  const { width } = useWindowDimensions();
  const scale = width / DESIGN_WIDTH;

  const [activeCard, setActiveCard] = useState<TutorialCardData | null>(null);

  useEffect(() => {
    reportEvent('tutorial', { action: 'open' });
  }, []);

  const handleContinue = () => {
    if (activeCard) return;
    playSfx('click');
    markTutorialSeen();
    reportEvent('tutorial', { action: 'complete' });
    if (from === 'play') {
      // Opened from the Play button on a first run — continue straight into
      // the game instead of bouncing back to the menu.
      router.replace('/game');
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const handleInfoPress = (card: TutorialCardData) => {
    reportEvent('tutorial', { action: 'info', card: card.id });
    setActiveCard(card);
  };

  const [tongue, attack, jump, hurty] = TUTORIAL_CARDS;

  return (
    <Pressable style={styles.root} onPress={handleContinue}>
      <Image
        source={require('@/assets/images/game/bg.webp')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
      <View style={[StyleSheet.absoluteFill, styles.dim]} />

      <GameHud
        meters={0}
        highest={bestHeight}
        coins={0}
        crystals={0}
        lives={maxLivesFor(upgrades.body)}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']} pointerEvents="box-none">
        <View style={{ height: HUD_BLOCK * scale }} />

        <View style={[styles.cardRow, { gap: 12 * scale }]}>
          <TutorialCard card={tongue} scale={scale} onInfoPress={() => handleInfoPress(tongue)} />
          <TutorialCard card={attack} scale={scale} onInfoPress={() => handleInfoPress(attack)} />
        </View>

        <View style={styles.scene} pointerEvents="none">
          <Image
            source={require('@/assets/images/game/platforms/start.webp')}
            style={styles.platform}
            contentFit="contain"
          />
          <Image
            source={require('@/assets/images/game/frog/idle.webp')}
            style={styles.frog}
            contentFit="contain"
          />
        </View>

        <View style={[styles.cardRow, { gap: 12 * scale }]}>
          <TutorialCard card={jump} scale={scale} onInfoPress={() => handleInfoPress(jump)} />
          <TutorialCard card={hurty} scale={scale} onInfoPress={() => handleInfoPress(hurty)} />
        </View>

        <Text style={[styles.continueText, { fontSize: 24 * scale }]}>Tap to continue...</Text>
      </SafeAreaView>

      <TutorialInfoModal card={activeCard} onClose={() => setActiveCard(null)} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B1410',
  },
  dim: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  scene: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platform: {
    position: 'absolute',
    width: 333,
    height: 244,
  },
  frog: {
    position: 'absolute',
    width: 182,
    height: 182,
    // Nudged up from the platform's visual center so the frog's feet land on the
    // platform's top surface rather than its middle.
    top: '38%',
  },
  continueText: {
    fontWeight: '400',
    color: Menu.textPrimary,
    textAlign: 'center',
    paddingTop: 8,
  },
});
