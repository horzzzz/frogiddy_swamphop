import {
  CAMERA_ANCHOR,
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  FROG_HALF_H,
  GAP_MIN_RATIO,
  MAX_JUMP_HEIGHT,
  MAX_PICKUPS,
  MAX_PLATFORMS,
} from '@/game/constants';
import {
  FrogState,
  PLATFORM_SPECS,
  PlatformType,
  TongueState,
  TongueTarget,
  TouchMode,
  type GameState,
} from '@/game/types';

/**
 * NOTE ON ORDER: a worklet captures the variables it references at the moment it
 * is created, not when it runs. A worklet that calls one defined further down
 * this file captures `undefined` and blows up at the first call. Helpers must
 * therefore be declared above every worklet that uses them.
 */

/** Puts the tongue away and forgets whatever it was pointing at. */
export function clearTongue(state: GameState) {
  'worklet';
  state.tongueState = TongueState.Idle;
  state.tongueTarget = TongueTarget.None;
  state.tongueTargetIndex = -1;
  state.tongueAnchorOffsetX = 0;
  state.tongueAimTarget = TongueTarget.None;
  state.tongueAimIndex = -1;
}

/** World Y the starting platform is placed at. Arbitrary — everything is relative to it. */
const START_PLATFORM_Y = 700;

/**
 * Returns the world to its opening position: frog idle on the starting platform,
 * every pool slot free, generation cursor primed just above the start.
 *
 * A worklet so death can restart the run on the UI thread without a round trip
 * through JS.
 */
export function resetRun(state: GameState, seed: number) {
  'worklet';
  state.platAlive.fill(0);
  state.pickAlive.fill(0);

  const spec = PLATFORM_SPECS[PlatformType.Start];
  const platX = (DESIGN_WIDTH - spec.w) / 2;

  state.platX[0] = platX;
  state.platY[0] = START_PLATFORM_Y;
  state.platType[0] = PlatformType.Start;
  state.platAlive[0] = 1;
  state.platBaseX[0] = platX;
  state.platRange[0] = 0;
  state.platPhase[0] = 0;

  state.frogX = platX + spec.w / 2;
  state.frogY = START_PLATFORM_Y + spec.surfaceY - FROG_HALF_H;
  state.frogVX = 0;
  state.frogVY = 0;
  state.frogState = FrogState.Idle;
  state.frogFacing = 1;
  state.grounded = true;
  state.groundedIndex = 0;

  state.camY = state.frogY - state.viewH * CAMERA_ANCHOR;

  state.running = true;
  state.startY = state.frogY;
  state.peakY = state.frogY;
  state.coins = 0;
  state.crystals = 0;

  clearTongue(state);
  state.tongueCooldown = 0;
  state.tongueUsedThisFlight = false;

  state.touchActive = false;
  state.touchMode = TouchMode.None;
  state.touchMoved = 0;
  state.touchStartedAt = 0;

  state.attackTimer = 0;

  state.aiming = false;
  state.aimDX = 0;
  state.aimDY = 0;
  state.aimPower = 0;

  // The generation cursor tracks surface heights, so start from the surface.
  state.nextSpawnY = START_PLATFORM_Y + spec.surfaceY - MAX_JUMP_HEIGHT * GAP_MIN_RATIO;
  state.rngState = seed >>> 0 || 1;

  state.accumulator = 0;
  state.elapsed = 0;
}

/**
 * Allocates the pools once. Called a single time per mounted game screen; after
 * this, `resetRun` recycles the same arrays and nothing else is ever allocated.
 */
export function createGameState(): GameState {
  const state: GameState = {
    frogX: 0,
    frogY: 0,
    frogVX: 0,
    frogVY: 0,
    frogState: FrogState.Idle,
    frogFacing: 1,
    grounded: false,
    groundedIndex: -1,

    camY: 0,
    viewH: DESIGN_HEIGHT,

    running: false,
    startY: 0,
    peakY: 0,
    coins: 0,
    crystals: 0,

    tongueState: TongueState.Idle,
    tongueTipX: 0,
    tongueTipY: 0,
    tongueAnchorX: 0,
    tongueAnchorY: 0,
    tongueTarget: TongueTarget.None,
    tongueTargetIndex: -1,
    tongueAnchorOffsetX: 0,
    tongueCooldown: 0,
    tongueUsedThisFlight: false,
    tongueAimTarget: TongueTarget.None,
    tongueAimIndex: -1,
    tongueAimX: 0,
    tongueAimY: 0,

    touchActive: false,
    touchMode: TouchMode.None,
    touchStartX: 0,
    touchStartY: 0,
    touchX: 0,
    touchY: 0,
    touchMoved: 0,
    touchStartedAt: 0,

    attackTimer: 0,

    aiming: false,
    aimDX: 0,
    aimDY: 0,
    aimPower: 0,

    nextSpawnY: 0,
    rngState: 1,

    accumulator: 0,
    elapsed: 0,

    platX: new Float32Array(MAX_PLATFORMS),
    platY: new Float32Array(MAX_PLATFORMS),
    platType: new Int8Array(MAX_PLATFORMS),
    platAlive: new Uint8Array(MAX_PLATFORMS),
    platBaseX: new Float32Array(MAX_PLATFORMS),
    platRange: new Float32Array(MAX_PLATFORMS),
    platPhase: new Float32Array(MAX_PLATFORMS),

    pickX: new Float32Array(MAX_PICKUPS),
    pickY: new Float32Array(MAX_PICKUPS),
    pickType: new Int8Array(MAX_PICKUPS),
    pickAlive: new Uint8Array(MAX_PICKUPS),
    pickPhase: new Float32Array(MAX_PICKUPS),
  };

  resetRun(state, 1);
  return state;
}


/** Height climbed this run, in metres, for the HUD. */
export function heightInMeters(state: GameState, pixelsPerMeter: number): number {
  'worklet';
  return Math.max(0, (state.startY - state.peakY) / pixelsPerMeter);
}
