import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CounterPill } from '@/components/menu/counter-pill';
import { Game } from '@/constants/theme';
import { DEBUG_OVERLAY, DESIGN_WIDTH } from '@/game/constants';

type GameHudProps = {
  meters: number;
  highest: number;
  coins: number;
  crystals: number;
  lives: number;
  /** Omit to render the pause icon as plain decoration — used by the tutorial screen's read-only HUD. */
  onPause?: () => void;
};

/**
 * The HUD lives in React views rather than on the Skia canvas so it can reuse the
 * app's fonts, pill artwork and safe-area handling.
 *
 * It is fed at 10 Hz by the game loop, not once per frame — a React re-render per
 * frame is exactly what the engine is built to avoid.
 */
export function GameHud({ meters, highest, coins, crystals, lives, onPause }: GameHudProps) {
  // Same design-unit-to-pixel convention the game canvas uses. The pause icon,
  // three pills and their gaps and padding add up to ~429 design units — right
  // under DESIGN_WIDTH's 430 by construction — so scaling the whole row by this
  // factor keeps it inside any screen width instead of running off the edge on
  // a phone narrower than the 430-wide mockup it was measured against.
  const { width } = useWindowDimensions();
  const scale = width / DESIGN_WIDTH;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']} pointerEvents="box-none">
      <View
        style={[
          styles.row,
          { gap: Game.pillGap * scale, paddingHorizontal: 24 * scale, paddingTop: 8 * scale },
        ]}
        pointerEvents="box-none">
        {onPause ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pause"
            onPress={onPause}
            hitSlop={12}
            style={[styles.pause, { width: Game.iconSize * scale, height: Game.iconSize * scale, gap: 5 * scale }]}>
            <View style={[styles.pauseBar, { width: 9 * scale, height: 26 * scale, borderRadius: 3 * scale }]} />
            <View style={[styles.pauseBar, { width: 9 * scale, height: 26 * scale, borderRadius: 3 * scale }]} />
          </Pressable>
        ) : (
          <View style={[styles.pause, { width: Game.iconSize * scale, height: Game.iconSize * scale, gap: 5 * scale }]}>
            <View style={[styles.pauseBar, { width: 9 * scale, height: 26 * scale, borderRadius: 3 * scale }]} />
            <View style={[styles.pauseBar, { width: 9 * scale, height: 26 * scale, borderRadius: 3 * scale }]} />
          </View>
        )}

        <CounterPill
          icon={require('@/assets/images/menu/icon-blu.webp')}
          value={String(crystals)}
          width={Game.pillWidth}
          scale={scale}
        />
        <CounterPill
          icon={require('@/assets/images/game/pickups/life.png')}
          value={String(lives)}
          width={Game.pillWidth}
          scale={scale}
        />
        <CounterPill
          icon={require('@/assets/images/menu/icon-coin.webp')}
          value={String(coins)}
          width={Game.pillWidth}
          scale={scale}
        />
      </View>

      <View style={[styles.heightBlock, { paddingTop: 12 * scale }]} pointerEvents="none">
        <Text style={[styles.meters, { fontSize: 28 * scale }]}>{`${meters.toFixed(0)} m`}</Text>
        <Text style={[styles.highest, { fontSize: 12 * scale, paddingTop: 6 * scale }]}>{`Highest ${highest.toFixed(1)} m`}</Text>
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
  },
  pause: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseBar: {
    backgroundColor: Game.pauseBar,
  },
  heightBlock: {
    alignItems: 'center',
  },
  meters: {
    fontFamily: 'BlackHanSans_400Regular',
    color: Game.textPrimary,
  },
  highest: {
    color: Game.textSecondary,
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
