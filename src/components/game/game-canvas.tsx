import {
  Canvas,
  PaintStyle,
  Picture,
  Skia,
  StrokeCap,
  TileMode,
  createPicture,
} from '@shopify/react-native-skia';
import { forwardRef, memo, useEffect, useImperativeHandle, useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  runOnJS,
  runOnUI,
  useAnimatedReaction,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import {
  ATTACK_RANGE_X,
  ATTACK_RANGE_Y,
  CAMERA_ANCHOR,
  DEATH_FX_SKULL_COLOR,
  DEATH_FX_SKULL_DARK_COLOR,
  DEATH_FX_SMOKE_COLOR,
  DESIGN_WIDTH,
  DUST_COLOR,
  PIXELS_PER_METER,
  SFX_DAMAGE,
  SFX_HIT,
  SFX_LAND,
  SFX_PICKUP,
  TONGUE_AIM_COLOR,
  TONGUE_AIM_WIDTH,
  TONGUE_COLOR,
  TONGUE_TIP_COLOR,
  TONGUE_WIDTH,
} from '@/game/constants';
import { endTouch } from '@/game/tongue';
import {
  SKULL_FEATURES_SVG,
  SKULL_PATH_SVG,
  drawScene,
  type RenderScratch,
} from '@/game/render';
import { createGameState, heightInMeters, resetRun } from '@/game/state';
import { advance } from '@/game/step';
import { FrogState, TouchMode } from '@/game/types';
import { useGameAssets } from '@/hooks/use-game-assets';
import { playSfx } from '@/services/audio';
import type { Weapon } from '@/constants/weapons';
import { autoJumpImpulseFor, maxLivesFor, tongueRangeFor, type FrogeneticsLevels } from '@/constants/frogenetics';

/**
 * How often run totals are pushed to the React HUD, in simulation seconds.
 * Never once per frame.
 */
const STATS_INTERVAL = 0.1;

/**
 * Turns one frame's worth of sound cues into playback. Module scope because
 * `runOnJS` needs a stable target — a function recreated per render would be
 * re-serialised to the UI thread on every one.
 */
function playGameSfx(cues: number) {
  if (cues & SFX_HIT) playSfx('hit');
  if (cues & SFX_PICKUP) playSfx('pickup');
  if (cues & SFX_DAMAGE) playSfx('hurt');
  if (cues & SFX_LAND) playSfx('land');
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
  /** Purchased Frogenetics levels — drive max health, tongue reach and auto-jump height. */
  upgrades: FrogeneticsLevels;
  /**
   * Horizontal input axis from the move joystick, -1..1. A shared value rather
   * than a prop the simulation reads directly, so the stick's own gesture can
   * write it on the UI thread without a round trip through React.
   */
  moveAxis: SharedValue<number>;
  onStats: (stats: RunStats) => void;
  onGameOver: (stats: RunStats) => void;
  /** Fired once every texture has finished uploading and the first real frame can draw. */
  onReady?: () => void;
};

const GameCanvasInner = forwardRef<GameCanvasHandle, GameCanvasProps>(function GameCanvas(
  { paused, weapon, upgrades, moveAxis, onStats, onGameOver, onReady },
  ref
) {
  const { width, height } = useWindowDimensions();
  const attackSprite = weapon?.attackSprite ?? DEFAULT_ATTACK_SPRITE;
  const assets = useGameAssets(attackSprite);
  const attackRangeX = weapon?.rangeX ?? ATTACK_RANGE_X;
  const attackRangeY = weapon?.rangeY ?? ATTACK_RANGE_Y;
  const maxLives = maxLivesFor(upgrades.body);
  const tongueRange = tongueRangeFor(upgrades.tongue);
  const autoJumpImpulse = autoJumpImpulseFor(upgrades.legs);

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
        autoJumpImpulse,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const state = useSharedValue(initialState);

  const scratch = useMemo<RenderScratch>(() => {
    const paint = Skia.Paint();
    paint.setAntiAlias(true);

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

    // Death-effect smoke. The gradient is authored once at radius 1 around the
    // origin and every puff, at every size, is drawn by scaling the canvas onto
    // it — so the soft edge costs one shader for the life of the screen rather
    // than a blur the GPU would re-evaluate every frame.
    const puffPaint = (color: string) => {
      const base = Skia.Color(color);
      const stop = (alpha: number) => Float32Array.of(base[0], base[1], base[2], alpha);
      const puff = Skia.Paint();
      puff.setAntiAlias(true);
      puff.setShader(
        Skia.Shader.MakeRadialGradient(
          { x: 0, y: 0 },
          1,
          [stop(1), stop(0.75), stop(0)],
          [0, 0.45, 1],
          TileMode.Clamp
        )
      );
      return puff;
    };

    const smokePaint = puffPaint(DEATH_FX_SMOKE_COLOR);
    const dustPaint = puffPaint(DUST_COLOR);

    const skullPaint = Skia.Paint();
    skullPaint.setAntiAlias(true);
    skullPaint.setColor(Skia.Color(DEATH_FX_SKULL_COLOR));

    // Stroke width is in the skull path's own units, so it scales with the
    // skull rather than needing to track DEATH_FX_SKULL_SIZE.
    const skullOutlinePaint = Skia.Paint();
    skullOutlinePaint.setAntiAlias(true);
    skullOutlinePaint.setStyle(PaintStyle.Stroke);
    skullOutlinePaint.setStrokeWidth(1.3);
    skullOutlinePaint.setColor(Skia.Color(DEATH_FX_SKULL_DARK_COLOR));

    const skullDarkPaint = Skia.Paint();
    skullDarkPaint.setAntiAlias(true);
    skullDarkPaint.setColor(Skia.Color(DEATH_FX_SKULL_DARK_COLOR));

    // The path data is a hardcoded constant, so a parse failure is an authoring
    // mistake rather than anything a player can hit. Degrade to an empty path
    // instead of throwing: losing a cosmetic effect beats taking the game screen
    // down with it, and the dev-only warning is what surfaces the real problem.
    const parsePath = (svg: string, name: string) => {
      const path = Skia.Path.MakeFromSVGString(svg);
      if (path) return path;
      if (__DEV__) console.warn(`[render] could not parse the ${name} path`);
      return Skia.Path.Make();
    };

    return {
      paint,
      tonguePaint,
      tongueTipPaint,
      aimPaint,
      enemyPaint,
      smokePaint,
      skullPaint,
      skullOutlinePaint,
      skullDarkPaint,
      dustPaint,
      skullPath: parsePath(SKULL_PATH_SVG, 'skull'),
      skullFeaturesPath: parsePath(SKULL_FEATURES_SVG, 'skull features'),
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
    runOnUI((maxLivesValue: number, tongueRangeValue: number, autoJumpImpulseValue: number) => {
      'worklet';
      const world = state.value;
      world.maxLives = maxLivesValue;
      world.tongueRange = tongueRangeValue;
      world.autoJumpImpulse = autoJumpImpulseValue;
    })(maxLives, tongueRange, autoJumpImpulse);
  }, [state, maxLives, tongueRange, autoJumpImpulse]);

  const frameCallback = useFrameCallback((info) => {
    'worklet';
    const world = state.value;
    world.moveAxis = moveAxis.value;
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

    // Throttled against the simulation clock, not Reanimated's frame clock.
    // `timeSinceFirstFrame` restarts at 0 every time the frame callback is
    // re-registered — which the worklet factory makes happen on *every* render
    // of this component, including the render each stats push itself triggers.
    // Comparing a fresh clock against a stale `lastStatsAt` stalled the HUD
    // until the clock climbed back past it, and since the threshold grew by one
    // interval each push, pickups took progressively longer to show up: 0.1s,
    // then 0.2s, then 0.3s… seconds behind within a minute of play.
    // `world.elapsed` survives re-registration, pause/resume and Game Over.
    if (world.elapsed - lastStatsAt.value >= STATS_INTERVAL) {
      lastStatsAt.value = world.elapsed;
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
        // `resetRun` zeroes `world.elapsed`, so the throttle's reference point
        // has to go back to 0 with it — otherwise the new run's clock has to
        // climb past the old run's length before the HUD updates again.
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

  // The gesture only records raw facts about the finger. What they mean —
  // tongue aim vs. attack tap — is decided in the simulation, because a
  // motionless hold produces no gesture updates and would otherwise never
  // resolve. `onFinalize` handles the release, which is a discrete event.
  // Capped to one pointer: the move joystick lives in its own sibling view and
  // never sends its touches here, but a second finger landing on the canvas
  // itself (e.g. steadying the phone) should not average into this gesture's
  // coordinates.
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .maxPointers(1)
        .onBegin((event) => {
          'worklet';
          const world = state.value;
          if (world.frogState === FrogState.Dead) return;

          world.touchActive = true;
          world.touchMode = TouchMode.Aim;
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

/**
 * The HUD is fed from inside this component, so every stats push re-renders the
 * parent — and without this barrier that render would come straight back here,
 * ten times a second, producing markup that never changes.
 *
 * The waste is not the render itself but what a render costs on the UI thread:
 * the worklet factory hands `useFrameCallback` a new function object every time,
 * which unregisters and re-registers the callback (tearing down and restarting
 * its `requestAnimationFrame` loop), and the effects and `useAnimatedReaction`
 * in the body re-dispatch alongside it.
 *
 * Every prop is already stable across a parent re-render — `weapon` is an
 * element of the module-level `WEAPONS`, `upgrades` a slice of the persisted
 * wallet, and the three callbacks are `useCallback`/`useState` setters — so the
 * shallow compare holds, while a real change (`paused`, a bought upgrade, a
 * newly equipped weapon) still gets through.
 */
export const GameCanvas = memo(GameCanvasInner);
