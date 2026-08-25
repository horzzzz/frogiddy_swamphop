import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { GameCanvas, type GameCanvasHandle, type RunStats } from '@/components/game/game-canvas';
import { GameHud } from '@/components/game/game-hud';
import { MoveJoystick } from '@/components/game/move-joystick';
import { MenuButton } from '@/components/menu/menu-button';
import { GameModal } from '@/components/modal/game-modal';
import { maxLivesFor } from '@/constants/frogenetics';
import { Game } from '@/constants/theme';
import { WEAPONS } from '@/constants/weapons';
import { adsEnabled, showRewarded } from '@/services/ads';
import { reportEvent } from '@/services/analytics';
import { playSfx } from '@/services/audio';
import { useEconomy } from '@/state/economy';

const emptyRun = (maxLives: number): RunStats => ({ meters: 0, coins: 0, crystals: 0, lives: maxLives });

/** Coin payout for watching a rewarded video from the pause menu. */
const WATCH_AD_COIN_REWARD = 300;

export default function GameScreen() {
  const router = useRouter();
  const { bestHeight, recordRun, equippedWeapon, upgrades, addCoins } = useEconomy();
  const weapon = WEAPONS.find((candidate) => candidate.id === equippedWeapon) ?? null;
  const maxLives = maxLivesFor(upgrades.body);

  const canvas = useRef<GameCanvasHandle>(null);
  const moveAxis = useSharedValue(0);
  const [stats, setStats] = useState<RunStats>(() => emptyRun(maxLives));
  const [paused, setPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);
  const [watchingAd, setWatchingAd] = useState(false);
  // Guards against double-banking: handleGameOver already records the run, and
  // the "Menu" button on the Game Over modal also routes through handleExit.
  const recordedRef = useRef(false);

  const handleGameOver = useCallback(
    (final: RunStats) => {
      setStats(final);
      setGameOver(true);
      playSfx('lose');
      reportEvent('game', { action: 'loss' });
      // The whole run is banked in one write — pickups never touch React state.
      recordedRef.current = true;
      recordRun(final.coins, final.crystals, final.meters);
    },
    [recordRun]
  );

  // Fires once per mount, for the run that's already live before any Retry tap.
  useEffect(() => {
    reportEvent('game', { action: 'start' });
  }, []);

  const handleRestart = useCallback(() => {
    setStats(emptyRun(maxLives));
    setGameOver(false);
    setPaused(false);
    recordedRef.current = false;
    // SharedValues are mutable containers by design; the compiler's
    // immutability check doesn't know that about the value `useSharedValue`
    // returned, only that it came out of a hook call.
    // eslint-disable-next-line react-hooks/immutability
    moveAxis.value = 0;
    canvas.current?.restart();
    reportEvent('game', { action: 'start' });
  }, [maxLives, moveAxis]);

  const handleExit = useCallback(() => {
    // Banks whatever the run has collected so far when leaving mid-run (e.g.
    // from the pause menu), rather than only on death.
    if (!recordedRef.current) {
      recordedRef.current = true;
      recordRun(stats.coins, stats.crystals, stats.meters);
    }
    router.back();
  }, [recordRun, router, stats]);

  // Stable so it does not defeat GameCanvas's memo barrier — an inline arrow
  // here would be a fresh prop on every stats push, i.e. ten times a second.
  const handleReady = useCallback(() => setAssetsReady(true), []);

  const handleWatchAd = useCallback(async () => {
    if (watchingAd) return;
    setWatchingAd(true);
    try {
      const earned = await showRewarded('pause_menu');
      if (earned) addCoins(WATCH_AD_COIN_REWARD);
    } finally {
      setWatchingAd(false);
    }
  }, [addCoins, watchingAd]);

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      <GameCanvas
        ref={canvas}
        paused={paused || gameOver}
        weapon={weapon}
        upgrades={upgrades}
        moveAxis={moveAxis}
        onStats={setStats}
        onGameOver={handleGameOver}
        onReady={handleReady}
      />

      {assetsReady && (
        <GameHud
          meters={stats.meters}
          // A run in progress can already be the record, so the header reflects it live.
          highest={Math.max(bestHeight, stats.meters)}
          coins={stats.coins}
          crystals={stats.crystals}
          lives={stats.lives}
          onPause={() => {
            // A finger left on the stick when the modal opens must not keep
            // driving the frog once it's back — the gesture's own onFinalize
            // never fires because the modal doesn't steal the touch.
            // eslint-disable-next-line react-hooks/immutability
            moveAxis.value = 0;
            setPaused(true);
          }}
        />
      )}

      {assetsReady && !paused && !gameOver && <MoveJoystick moveAxis={moveAxis} />}

      {!assetsReady && (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator size="large" color={Game.textPrimary} />
        </View>
      )}

      <GameModal visible={paused} title="Paused" onClose={() => setPaused(false)} dismissable>
        <MenuButton label="Resume" onPress={() => setPaused(false)} />
        {adsEnabled() && (
          <MenuButton
            label={watchingAd ? 'Loading…' : 'Watch AD'}
            onPress={handleWatchAd}
            disabled={watchingAd}
          />
        )}
        <MenuButton label="Menu" onPress={handleExit} />
      </GameModal>

      <GameModal visible={gameOver} title="Game Over" onClose={handleExit} dismissable={false}>
        <View style={styles.results}>
          <Text style={styles.resultValue}>{`${stats.meters.toFixed(1)} m`}</Text>
          <Text style={styles.resultLabel}>
            {`+${stats.coins} coins   +${stats.crystals} crystals`}
          </Text>
        </View>
        <MenuButton label="Retry" onPress={handleRestart} />
        <MenuButton label="Menu" onPress={handleExit} />
      </GameModal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B1410',
  },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  results: {
    alignItems: 'center',
    gap: 6,
  },
  resultValue: {
    fontFamily: 'BlackHanSans_400Regular',
    fontSize: 40,
    color: Game.textPrimary,
  },
  resultLabel: {
    fontSize: 14,
    color: Game.textSecondary,
  },
});
