import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CounterPill } from '@/components/menu/counter-pill';
import { Game } from '@/constants/theme';
import { DEBUG_OVERLAY } from '@/game/constants';

type GameHudProps = {
  meters: number;
  highest: number;
  coins: number;
  crystals: number;
  lives: number;
  onPause: () => void;
};

/**
 * The HUD lives in React views rather than on the Skia canvas so it can reuse the
 * app's fonts, pill artwork and safe-area handling.
 *
 * It is fed at 10 Hz by the game loop, not once per frame — a React re-render per
 * frame is exactly what the engine is built to avoid.
 */
export function GameHud({ meters, highest, coins, crystals, lives, onPause }: GameHudProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']} pointerEvents="box-none">
      <View style={styles.row} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pause"
          onPress={onPause}
          hitSlop={12}
          style={styles.pause}>
          <View style={styles.pauseBar} />
          <View style={styles.pauseBar} />
        </Pressable>

        <CounterPill
          icon={require('@/assets/images/menu/icon-blu.webp')}
          value={String(crystals)}
          width={Game.pillWidth}
        />
        <CounterPill
          icon={require('@/assets/images/game/pickups/life.png')}
          value={String(lives)}
          width={Game.pillWidth}
        />
        <CounterPill
          icon={require('@/assets/images/menu/icon-coin.webp')}
          value={String(coins)}
          width={Game.pillWidth}
        />
      </View>

      <View style={styles.heightBlock} pointerEvents="none">
        <Text style={styles.meters}>{`${meters.toFixed(0)} m`}</Text>
        <Text style={styles.highest}>{`Highest ${highest.toFixed(1)} m`}</Text>
      </View>

      {DEBUG_OVERLAY ? (
        <View style={styles.debug} pointerEvents="none">
          <Text style={styles.debugText}>{`m ${meters.toFixed(2)}`}</Text>
          <Text style={styles.debugText}>{`coins ${coins}  crystals ${crystals}`}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Game.pillGap,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  pause: {
    width: Game.iconSize,
    height: Game.iconSize,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  pauseBar: {
    width: 9,
    height: 26,
    borderRadius: 3,
    backgroundColor: Game.pauseBar,
  },
  heightBlock: {
    alignItems: 'center',
    paddingTop: 12,
  },
  meters: {
    fontFamily: 'BlackHanSans_400Regular',
    fontSize: 28,
    color: Game.textPrimary,
  },
  highest: {
    fontSize: 12,
    color: Game.textSecondary,
    paddingTop: 6,
  },
  debug: {
    position: 'absolute',
    left: 24,
    bottom: 40,
  },
  debugText: {
    fontSize: 11,
    color: Game.textSecondary,
  },
});
