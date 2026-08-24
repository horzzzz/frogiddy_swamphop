import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GameCanvas, type GameCanvasHandle, type RunStats } from '@/components/game/game-canvas';
import { GameHud } from '@/components/game/game-hud';
import { MenuButton } from '@/components/menu/menu-button';
import { GameModal } from '@/components/modal/game-modal';
import { Game } from '@/constants/theme';
import { MAX_LIVES } from '@/game/constants';
import { useEconomy } from '@/state/economy';

const EMPTY_RUN: RunStats = { meters: 0, coins: 0, crystals: 0, lives: MAX_LIVES };

export default function GameScreen() {
  const router = useRouter();
  const { bestHeight, recordRun } = useEconomy();

  const canvas = useRef<GameCanvasHandle>(null);
  const [stats, setStats] = useState<RunStats>(EMPTY_RUN);
  const [paused, setPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const handleGameOver = useCallback(
    (final: RunStats) => {
      setStats(final);
      setGameOver(true);
      // The whole run is banked in one write — pickups never touch React state.
      recordRun(final.coins, final.crystals, final.meters);
    },
    [recordRun]
  );

  const handleRestart = useCallback(() => {
    setStats(EMPTY_RUN);
    setGameOver(false);
    setPaused(false);
    canvas.current?.restart();
  }, []);

  const handleExit = useCallback(() => router.back(), [router]);

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      <GameCanvas
        ref={canvas}
        paused={paused || gameOver}
        onStats={setStats}
        onGameOver={handleGameOver}
      />

      <GameHud
        meters={stats.meters}
        // A run in progress can already be the record, so the header reflects it live.
        highest={Math.max(bestHeight, stats.meters)}
        coins={stats.coins}
        crystals={stats.crystals}
        lives={stats.lives}
        onPause={() => setPaused(true)}
      />

      <GameModal visible={paused} title="Paused" onClose={() => setPaused(false)} dismissable>
        <MenuButton label="Resume" onPress={() => setPaused(false)} />
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
