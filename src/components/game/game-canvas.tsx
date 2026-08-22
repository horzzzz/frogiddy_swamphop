import { Canvas, Picture, Skia, createPicture } from '@shopify/react-native-skia';
import { forwardRef, useEffect, useImperativeHandle, useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  runOnJS,
  runOnUI,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';

import { CAMERA_ANCHOR, DESIGN_WIDTH, PIXELS_PER_METER } from '@/game/constants';
import { applyAim, launchFrog } from '@/game/physics';
import { drawScene, type RenderScratch } from '@/game/render';
import { createGameState, heightInMeters, resetRun } from '@/game/state';
import { advance } from '@/game/step';
import { FrogState } from '@/game/types';
import { useGameAssets } from '@/hooks/use-game-assets';

/** How often run totals are pushed to the React HUD. Never once per frame. */
const STATS_INTERVAL_MS = 100;

export type GameCanvasHandle = {
  /** Restarts the run in place, without remounting the canvas or reloading textures. */
  restart: () => void;
};

export type RunStats = {
  meters: number;
  coins: number;
  crystals: number;
};

type GameCanvasProps = {
  paused: boolean;
  onStats: (stats: RunStats) => void;
  onGameOver: (stats: RunStats) => void;
};

export const GameCanvas = forwardRef<GameCanvasHandle, GameCanvasProps>(function GameCanvas(
  { paused, onStats, onGameOver },
  ref
) {
  const { width, height } = useWindowDimensions();
  const assets = useGameAssets();

  // Scaling is driven by width so the horizontal wrap matches the 430-wide
  // mockups exactly; the visible height in design units then follows from the
  // device's aspect ratio.
  const scale = width / DESIGN_WIDTH;
  const viewH = height / scale;

  // Allocated once for the lifetime of the screen. Everything after this point
  // mutates these in place — no allocation happens inside a frame.
  const initialState = useMemo(() => createGameState(), []);
  const state = useSharedValue(initialState);

  const scratch = useMemo<RenderScratch>(() => {
    const paint = Skia.Paint();
    paint.setAntiAlias(true);

    const dotPaint = Skia.Paint();
    dotPaint.setAntiAlias(true);
    dotPaint.setColor(Skia.Color('#FFFFFF'));

    return {
      paint,
      dotPaint,
      dst: Skia.XYWHRect(0, 0, 0, 0),
      src: Skia.XYWHRect(0, 0, 0, 0),
    };
  }, []);

  /** Simulation time, published once per frame. Drives both the redraw and cosmetic motion. */
  const clock = useSharedValue(0);
  const lastStatsAt = useSharedValue(0);
  const gameOverSent = useSharedValue(false);

  // Keep the simulation's idea of the viewport in step with the real one, and
  // re-anchor the camera: without this the frog would sit at the wrong height on
  // any device whose aspect ratio is not the design frame's.
  useEffect(() => {
    runOnUI((visibleHeight: number) => {
      'worklet';
      const world = state.value;
      world.viewH = visibleHeight;
      world.camY = world.frogY - visibleHeight * CAMERA_ANCHOR;
    })(viewH);
  }, [state, viewH]);

  const frameCallback = useFrameCallback((info) => {
    'worklet';
    const world = state.value;
    advance(world, (info.timeSincePreviousFrame ?? 16.667) / 1000);
    clock.value = world.elapsed;

    if (world.frogState === FrogState.Dead) {
      if (!gameOverSent.value) {
        gameOverSent.value = true;
        runOnJS(onGameOver)({
          meters: heightInMeters(world, PIXELS_PER_METER),
          coins: world.coins,
          crystals: world.crystals,
        });
      }
      return;
    }

    if (info.timeSinceFirstFrame - lastStatsAt.value >= STATS_INTERVAL_MS) {
      lastStatsAt.value = info.timeSinceFirstFrame;
      runOnJS(onStats)({
        meters: heightInMeters(world, PIXELS_PER_METER),
        coins: world.coins,
        crystals: world.crystals,
      });
    }
  });

  useEffect(() => {
    frameCallback.setActive(!paused);
  }, [frameCallback, paused]);

  useImperativeHandle(
    ref,
    () => ({
      restart: () => {
        gameOverSent.value = false;
        const seed = (Date.now() & 0x7fffffff) || 1;
        runOnUI((nextSeed: number, visibleHeight: number) => {
          'worklet';
          const world = state.value;
          world.viewH = visibleHeight;
          resetRun(world, nextSeed);
        })(seed, viewH);
      },
    }),
    [gameOverSent, state, viewH]
  );

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          'worklet';
          const world = state.value;
          if (!world.grounded || world.frogState === FrogState.Dead) return;
          world.aiming = true;
          world.aimPower = 0;
        })
        .onUpdate((event) => {
          'worklet';
          const world = state.value;
          if (!world.grounded || world.frogState === FrogState.Dead) return;
          // Drag arrives in screen pixels; the aim thresholds are design units.
          applyAim(world, event.translationX / scale, event.translationY / scale);
        })
        .onEnd(() => {
          'worklet';
          const world = state.value;
          if (!world.aiming || !world.grounded) return;
          if (world.aimPower > 0) launchFrog(world);
        })
        .onFinalize(() => {
          'worklet';
          // Covers cancellation: a gesture interrupted mid-drag must not leave a
          // trajectory drawn on screen.
          state.value.aiming = false;
        }),
    [scale, state]
  );

  const picture = useDerivedValue(() => {
    const now = clock.value;
    const bundle = assets.value;
    const world = state.value;

    return createPicture(
      (canvas) => {
        if (bundle === null) return;
        drawScene(canvas, world, bundle, scratch, scale, now);
      },
      { width, height }
    );
  });

  return (
    <GestureDetector gesture={gesture}>
      <Canvas style={StyleSheet.absoluteFill} opaque>
        <Picture picture={picture} />
      </Canvas>
    </GestureDetector>
  );
});
