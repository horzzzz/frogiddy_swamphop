import {
  Canvas,
  PaintStyle,
  Picture,
  Skia,
  StrokeCap,
  createPicture,
} from '@shopify/react-native-skia';
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

import {
  CAMERA_ANCHOR,
  DESIGN_WIDTH,
  PIXELS_PER_METER,
  TONGUE_AIM_COLOR,
  TONGUE_AIM_WIDTH,
  TONGUE_COLOR,
  TONGUE_TIP_COLOR,
  TONGUE_WIDTH,
} from '@/game/constants';
import { endTouch } from '@/game/tongue';
import { drawScene, type RenderScratch } from '@/game/render';
import { createGameState, heightInMeters, resetRun } from '@/game/state';
import { advance } from '@/game/step';
import { FrogState, TouchMode } from '@/game/types';
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
  lives: number;
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

    // Stroke widths are in design units; the canvas is scaled once for the whole
    // scene, so they thicken with the rest of the art rather than staying hairline.
    const tonguePaint = Skia.Paint();
    tonguePaint.setAntiAlias(true);
    tonguePaint.setStyle(PaintStyle.Stroke);
    tonguePaint.setStrokeWidth(TONGUE_WIDTH);
    tonguePaint.setStrokeCap(StrokeCap.Round);
    tonguePaint.setColor(Skia.Color(TONGUE_COLOR));

    const tongueTipPaint = Skia.Paint();
    tongueTipPaint.setAntiAlias(true);
    tongueTipPaint.setColor(Skia.Color(TONGUE_TIP_COLOR));

    const aimPaint = Skia.Paint();
    aimPaint.setAntiAlias(true);
    aimPaint.setStyle(PaintStyle.Stroke);
    aimPaint.setStrokeWidth(TONGUE_AIM_WIDTH);
    aimPaint.setStrokeCap(StrokeCap.Round);
    aimPaint.setColor(Skia.Color(TONGUE_AIM_COLOR));

    // Alpha rewritten per draw: enemy fade-out on death and the frog's i-frame
    // flicker both reuse this one paint rather than each needing their own.
    const enemyPaint = Skia.Paint();
    enemyPaint.setAntiAlias(true);

    return {
      paint,
      dotPaint,
      tonguePaint,
      tongueTipPaint,
      aimPaint,
      enemyPaint,
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
          lives: world.lives,
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
        lives: world.lives,
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

  // The gesture only records raw facts about the finger. What they mean — jump
  // drag, tongue aim, attack tap — is decided in the simulation, because a
  // motionless hold produces no gesture updates and would otherwise never
  // resolve. `onFinalize` handles the release, which is a discrete event.
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin((event) => {
          'worklet';
          const world = state.value;
          if (world.frogState === FrogState.Dead) return;

          world.touchActive = true;
          world.touchMode = TouchMode.Undecided;
          world.touchStartX = event.x / scale;
          world.touchStartY = event.y / scale;
          world.touchX = world.touchStartX;
          world.touchY = world.touchStartY;
          world.touchMoved = 0;
          world.touchStartedAt = world.elapsed;
        })
        .onUpdate((event) => {
          'worklet';
          const world = state.value;
          if (!world.touchActive) return;

          world.touchX = event.x / scale;
          world.touchY = event.y / scale;

          const dx = world.touchX - world.touchStartX;
          const dy = world.touchY - world.touchStartY;
          // Track the furthest excursion, not the current one: a drag that
          // returns to where it started is still a drag, never a tap.
          const moved = Math.sqrt(dx * dx + dy * dy);
          if (moved > world.touchMoved) world.touchMoved = moved;
        })
        .onFinalize(() => {
          'worklet';
          endTouch(state.value);
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
