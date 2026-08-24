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
  useAnimatedReaction,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';

import {
  ATTACK_RANGE_X,
  ATTACK_RANGE_Y,
  CAMERA_ANCHOR,
  DESIGN_WIDTH,
  PIXELS_PER_METER,
  SFX_DAMAGE,
  SFX_HIT,
  SFX_PICKUP,
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
import { playSfx } from '@/services/audio';
import type { Weapon } from '@/constants/weapons';
import { jumpImpulsesFor, maxLivesFor, tongueRangeFor, type FrogeneticsLevels } from '@/constants/frogenetics';

/** How often run totals are pushed to the React HUD. Never once per frame. */
const STATS_INTERVAL_MS = 100;

/**
 * Turns one frame's worth of sound cues into playback. Module scope because
 * `runOnJS` needs a stable target — a function recreated per render would be
 * re-serialised to the UI thread on every one.
 */
function playGameSfx(cues: number) {
  if (cues & SFX_HIT) playSfx('hit');
  if (cues & SFX_PICKUP) playSfx('pickup');
  if (cues & SFX_DAMAGE) playSfx('hurt');
}

/** Bare-fisted attack pose — used whenever no Arsenal weapon is equipped. */
const DEFAULT_ATTACK_SPRITE = require('@/assets/images/game/frog/attack.webp');

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
  /** Currently equipped Arsenal weapon, or null for the unarmed default. */
  weapon: Weapon | null;
  /** Purchased Frogenetics levels — drive max health, tongue reach and jump power. */
  upgrades: FrogeneticsLevels;
  onStats: (stats: RunStats) => void;
  onGameOver: (stats: RunStats) => void;
  /** Fired once every texture has finished uploading and the first real frame can draw. */
  onReady?: () => void;
};

export const GameCanvas = forwardRef<GameCanvasHandle, GameCanvasProps>(function GameCanvas(
  { paused, weapon, upgrades, onStats, onGameOver, onReady },
  ref
) {
  const { width, height } = useWindowDimensions();
  const attackSprite = weapon?.attackSprite ?? DEFAULT_ATTACK_SPRITE;
  const assets = useGameAssets(attackSprite);
  const attackRangeX = weapon?.rangeX ?? ATTACK_RANGE_X;
  const attackRangeY = weapon?.rangeY ?? ATTACK_RANGE_Y;
  const maxLives = maxLivesFor(upgrades.body);
  const tongueRange = tongueRangeFor(upgrades.tongue);
  const jumpImpulses = jumpImpulsesFor(upgrades.legs);

  // Scaling is driven by width so the horizontal wrap matches the 430-wide
  // mockups exactly; the visible height in design units then follows from the
  // device's aspect ratio.
  const scale = width / DESIGN_WIDTH;
  const viewH = height / scale;

  // Allocated once for the lifetime of the screen, seeded with whatever
  // Frogenetics levels are current at mount so the very first run already
  // reflects them. Everything after this point mutates these in place — no
  // allocation happens inside a frame.
  const initialState = useMemo(
    () =>
      createGameState({
        maxLives,
        tongueRange,
        jumpImpulseMin: jumpImpulses.min,
        jumpImpulseMax: jumpImpulses.max,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
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

  // Screen setup, not run state — mirrors the viewH effect above. `resetRun`
  // deliberately leaves these alone, so switching weapons mid-run (impossible
  // today, since the Arsenal is a different screen) wouldn't need a restart.
  useEffect(() => {
    runOnUI((rangeX: number, rangeY: number) => {
      'worklet';
      const world = state.value;
      world.attackRangeX = rangeX;
      world.attackRangeY = rangeY;
    })(attackRangeX, attackRangeY);
  }, [state, attackRangeX, attackRangeY]);

  // Frogenetics stats, same convention as the attack-range effect above: screen
  // setup applied on top of whatever createGameState seeded, so a level bought
  // between runs takes effect without remounting the canvas.
  useEffect(() => {
    runOnUI((maxLivesValue: number, tongueRangeValue: number, jumpMin: number, jumpMax: number) => {
      'worklet';
      const world = state.value;
      world.maxLives = maxLivesValue;
      world.tongueRange = tongueRangeValue;
      world.jumpImpulseMin = jumpMin;
      world.jumpImpulseMax = jumpMax;
    })(maxLives, tongueRange, jumpImpulses.min, jumpImpulses.max);
  }, [state, maxLives, tongueRange, jumpImpulses]);

  const frameCallback = useFrameCallback((info) => {
    'worklet';
    const world = state.value;
    advance(world, (info.timeSincePreviousFrame ?? 16.667) / 1000);
    clock.value = world.elapsed;

    // At most one hop to JS per frame: every cue raised across this frame's
    // substeps is drained together, so a busy frame costs no more than a quiet
    // one and the audio never lands in the middle of the physics loop.
    if (world.sfxFlags !== 0) {
      const cues = world.sfxFlags;
      world.sfxFlags = 0;
      runOnJS(playGameSfx)(cues);
    }

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

  // Assets stream in on their own schedule after mount — this is the only signal
  // the JS side has for when the first real (non-empty) frame is on screen, so
  // the game screen can hold a loader over the canvas until then.
  useAnimatedReaction(
    () => assets.value !== null,
    (isReady, wasReady) => {
      if (isReady && !wasReady && onReady) runOnJS(onReady)();
    },
    [onReady]
  );

  useImperativeHandle(
    ref,
    () => ({
      restart: () => {
        gameOverSent.value = false;
        // The frame callback got deactivated for the Game Over pause, and
        // Reanimated resets its `timeSinceFirstFrame` clock to 0 the next time
        // it's reactivated (see FrameCallbackRegistryUI's `startTime = null` on
        // deactivate). Without this, `lastStatsAt` keeps the previous run's
        // large leftover value, so `timeSinceFirstFrame - lastStatsAt` goes
        // negative and the HUD doesn't get another stats push until the new
        // run's clock climbs back past however long the last run lasted —
        // which reads as "the counters just don't update after retry".
        lastStatsAt.value = 0;
        const seed = (Date.now() & 0x7fffffff) || 1;
        runOnUI((nextSeed: number, visibleHeight: number) => {
          'worklet';
          const world = state.value;
          world.viewH = visibleHeight;
          resetRun(world, nextSeed);
        })(seed, viewH);
      },
    }),
    [gameOverSent, lastStatsAt, state, viewH]
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
