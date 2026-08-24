import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { GameCanvas, type GameCanvasHandle, type RunStats } from '@/components/game/game-canvas';
import { GameHud } from '@/components/game/game-hud';
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
  const [stats, setStats] = useState<RunStats>(() => emptyRun(maxLives));
  const [paused, setPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);
  const [watchingAd, setWatchingAd] = useState(false);

  const handleGameOver = useCallback(
    (final: RunStats) => {
      setStats(final);
      setGameOver(true);
      playSfx('lose');
      reportEvent('game', { action: 'loss' });
      // The whole run is banked in one write — pickups never touch React state.
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
    canvas.current?.restart();
    reportEvent('game', { action: 'start' });
  }, [maxLives]);

  const handleExit = useCallback(() => router.back(), [router]);

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
        onStats={setStats}
        onGameOver={handleGameOver}
        onReady={() => setAssetsReady(true)}
      />

      {assetsReady && (
        <GameHud
          meters={stats.meters}
          // A run in progress can already be the record, so the header reflects it live.
          highest={Math.max(bestHeight, stats.meters)}
          coins={stats.coins}
          crystals={stats.crystals}
          lives={stats.lives}
          onPause={() => setPaused(true)}
        />
      )}

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
