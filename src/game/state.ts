import {
  ATTACK_RANGE_X,
  ATTACK_RANGE_Y,
  AUTO_JUMP_IMPULSE_BASE,
  BASE_MAX_LIVES,
  CAMERA_ANCHOR,
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  ENEMY_DEATH_LINGER,
  ENEMY_KILL_COINS,
  EYES_ZOOM_BASE,
  FROG_HALF_H,
  GAP_MIN,
  HUD_COIN_TARGET_X,
  HUD_CRYSTAL_TARGET_X,
  HUD_LIFE_TARGET_X,
  HUD_TARGET_Y,
  MAX_DEATH_FX,
  MAX_DUST,
  MAX_ENEMIES,
  MAX_FLYERS,
  MAX_PICKUPS,
  MAX_PLATFORMS,
  SFX_HIT,
  TONGUE_RANGE_BASE,
} from '@/game/constants';
import {
  EnemyState,
  FrogState,
  PickupType,
  type PickupTypeValue,
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

/**
 * Sends a cosmetic clone of a collected coin/crystal/life icon flying to
 * roughly where its HUD counter sits — see `MAX_FLYERS`'s own comment in
 * constants.ts. Silently does nothing if the pool is full; the currency was
 * already credited by the caller regardless.
 *
 * Declared above `killEnemy`, which calls it, for the ordering reason
 * documented on `killEnemy` below.
 */
export function spawnFlyer(state: GameState, kind: PickupTypeValue, x: number, y: number) {
  'worklet';
  let index = -1;
  for (let i = 0; i < MAX_FLYERS; i += 1) {
    if (state.flyAlive[i] === 0) {
      index = i;
      break;
    }
  }
  if (index === -1) return;

  state.flyAlive[index] = 1;
  state.flyKind[index] = kind;
  state.flyElapsed[index] = 0;
  state.flyStartX[index] = x;
  state.flyStartY[index] = y;
  state.flyTargetY[index] = HUD_TARGET_Y;
  if (kind === PickupType.Crystal) state.flyTargetX[index] = HUD_CRYSTAL_TARGET_X;
  else if (kind === PickupType.Life) state.flyTargetX[index] = HUD_LIFE_TARGET_X;
  else state.flyTargetX[index] = HUD_COIN_TARGET_X;
}

/**
 * Starts the puff-of-smoke-and-a-skull that marks a kill, at the point the enemy
 * died. Stores world coordinates — unlike `spawnFlyer` above, which freezes
 * screen ones because it is aiming at a fixed HUD pill; this effect stays put in
 * the world and scrolls with the camera like the corpse it replaces.
 *
 * `seed` varies the puff spread and the skull's sway between kills. Callers pass
 * the dying enemy's own `enemyPhase`, which is already a random value assigned
 * at spawn — deliberately *not* a fresh `nextRandom`, because drawing from the
 * run's seeded generator here would make level generation depend on how many
 * enemies the player killed, and a run would stop being reproducible from its
 * seed. See the note in rng.ts.
 *
 * Silently does nothing if the pool is full, same as `spawnFlyer`. Declared
 * above `killEnemy` for the ordering reason documented there.
 */
export function spawnDeathFx(state: GameState, x: number, y: number, seed: number) {
  'worklet';
  let index = -1;
  for (let i = 0; i < MAX_DEATH_FX; i += 1) {
    if (state.fxAlive[i] === 0) {
      index = i;
      break;
    }
  }
  if (index === -1) return;

  state.fxAlive[index] = 1;
  state.fxX[index] = x;
  state.fxY[index] = y;
  state.fxElapsed[index] = 0;
  state.fxSeed[index] = seed;
}

/**
 * Kicks up the dust of a landing, at the frog's feet. Every puff is the same
 * size regardless of how far the frog fell — the caller decides only *whether* a
 * landing was hard enough to raise one.
 *
 * `seed` only has to vary between landings; callers pass `state.elapsed`, which
 * is part of the deterministic simulation and so costs no draw from the run's
 * seeded generator — same reasoning as `spawnDeathFx` above.
 */
export function spawnDust(state: GameState, x: number, y: number, seed: number) {
  'worklet';
  let index = -1;
  for (let i = 0; i < MAX_DUST; i += 1) {
    if (state.dustAlive[i] === 0) {
      index = i;
      break;
    }
  }
  if (index === -1) return;

  state.dustAlive[index] = 1;
  state.dustX[index] = x;
  state.dustY[index] = y;
  state.dustElapsed[index] = 0;
  state.dustSeed[index] = seed;
}

/**
 * Turns a live enemy into a fading corpse. Shared by the sword and the stomp, so
 * a kill always looks and behaves the same regardless of how it happened.
 * `knockVX`/`knockVY` are the corpse's flight speed while it fades — a stomp
 * kill leaves them at the default 0 (see `physics.ts`'s stomp check), a melee
 * kill sends them along the swing (see `triggerAttack` in `tongue.ts`).
 *
 * Also banks the flat per-kill coin reward and sends it flying to the coin
 * counter — centralised here so every kill path pays out the same way without
 * each call site repeating it.
 *
 * Declared here, above `resetRun`, for the same reason `clearTongue` is: a
 * worklet captures the functions it calls at the moment it is *defined*, not
 * when it runs, so a forward reference within this file resolves to `undefined`
 * and blows up on the first call. This file must never import another game
 * module, which is what keeps it safe to sit at the bottom of that graph.
 */
export function killEnemy(state: GameState, index: number, knockVX = 0, knockVY = 0) {
  'worklet';
  state.enemyState[index] = EnemyState.Dying;
  state.enemyTimer[index] = ENEMY_DEATH_LINGER;
  state.enemyDeathVX[index] = knockVX;
  state.enemyDeathVY[index] = knockVY;

  state.sfxFlags |= SFX_HIT;
  state.coins += ENEMY_KILL_COINS;
  // Screen-space, same camera-and-zoom conversion `collectPickups` uses in
  // physics.ts — see `spawnFlyer`'s own doc comment for why.
  spawnFlyer(
    state,
    PickupType.Coin,
    (state.enemyX[index] - state.camX) * state.zoom,
    (state.enemyY[index] - state.camY) * state.zoom
  );
  spawnDeathFx(state, state.enemyX[index], state.enemyY[index], state.enemyPhase[index]);
}

/** World Y the starting platform is placed at. Arbitrary — everything is relative to it. */
const START_PLATFORM_Y = 700;

/**
 * Returns the world to its opening position: frog idle on the starting platform,
 * every pool slot free, generation cursor primed just above the start.
 *
 * A worklet so death can restart the run on the UI thread without a round trip
 * through JS. Deliberately does not touch `maxLives`, `tongueRange`,
 * `autoJumpImpulse` — those are Frogenetics screen setup, same as
 * `attackRangeX/Y`, and are only ever written by the canvas's setup effects.
 */
export function resetRun(state: GameState, seed: number) {
  'worklet';
  state.platAlive.fill(0);
  state.pickAlive.fill(0);
  state.enemyAlive.fill(0);
  state.flyAlive.fill(0);
  state.fxAlive.fill(0);
  state.dustAlive.fill(0);

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
  // `spawnRow` always writes the platform's *centre* here — match that, or
  // the very first generated row starts life offset by half the start
  // platform's own width.
  state.lastSpawnX = platX + spec.w / 2;
  state.lastPlatformWasSpikes = 0;
  state.frogVX = 0;
  state.frogVY = 0;
  state.frogState = FrogState.Idle;
  state.frogFacing = 1;
  state.grounded = true;
  state.groundedIndex = 0;
  state.wallSide = 0;
  state.wallTimer = 0;

  state.lives = state.maxLives;
  state.hurtTimer = 0;

  state.camY = state.frogY - state.viewH * CAMERA_ANCHOR;
  // Same clamp `updateCamera` applies every frame after this — seeded once
  // here so the very first drawn frame isn't centred on world X 0 while the
  // frog sits mid-field.
  state.camX = Math.min(Math.max(0, DESIGN_WIDTH - state.viewW), Math.max(0, state.frogX - state.viewW / 2));

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

  state.moveAxis = 0;

  // The generation cursor tracks surface heights, so start from the surface.
  state.nextSpawnY = START_PLATFORM_Y + spec.surfaceY - GAP_MIN;
  state.rngState = seed >>> 0 || 1;

  state.accumulator = 0;
  state.elapsed = 0;
  // Anything raised on the frame the previous run ended would otherwise fire
  // one frame into the new one.
  state.sfxFlags = 0;
}

/** Frogenetics stats a fresh GameState is seeded with. */
export type GameStateSetup = {
  maxLives: number;
  tongueRange: number;
  autoJumpImpulse: number;
  zoom: number;
};

const DEFAULT_SETUP: GameStateSetup = {
  maxLives: BASE_MAX_LIVES,
  tongueRange: TONGUE_RANGE_BASE,
  autoJumpImpulse: AUTO_JUMP_IMPULSE_BASE,
  zoom: EYES_ZOOM_BASE,
};

/**
 * Allocates the pools once. Called a single time per mounted game screen; after
 * this, `resetRun` recycles the same arrays and nothing else is ever allocated.
 *
 * `setup` seeds the Frogenetics-driven fields so the very first run already
 * reflects purchased upgrades — the canvas's own setup effects run after this
 * and after `resetRun`, too late for a level that starts mid-jump.
 */
export function createGameState(setup: GameStateSetup = DEFAULT_SETUP): GameState {
  const state: GameState = {
    frogX: 0,
    frogY: 0,
    frogVX: 0,
    frogVY: 0,
    frogState: FrogState.Idle,
    frogFacing: 1,
    grounded: false,
    groundedIndex: -1,
    /** -1 clinging to the left edge, 1 the right, 0 not clinging. */
    wallSide: 0,
    /** Counts down WALL_CLING_GRACE while a cling is frozen; see `stepWallCling`. */
    wallTimer: 0,

    lives: setup.maxLives,
    hurtTimer: 0,

    camY: 0,
    viewH: DESIGN_HEIGHT,
    camX: 0,
    viewW: DESIGN_WIDTH / setup.zoom,
    zoom: setup.zoom,

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
    attackRangeX: ATTACK_RANGE_X,
    attackRangeY: ATTACK_RANGE_Y,

    maxLives: setup.maxLives,
    tongueRange: setup.tongueRange,
    autoJumpImpulse: setup.autoJumpImpulse,
    lastSpawnX: 0,
    lastPlatformWasSpikes: 0,
    moveAxis: 0,

    nextSpawnY: 0,
    rngState: 1,

    accumulator: 0,
    elapsed: 0,
    sfxFlags: 0,

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

    enemyX: new Float32Array(MAX_ENEMIES),
    enemyY: new Float32Array(MAX_ENEMIES),
    enemyType: new Int8Array(MAX_ENEMIES),
    enemyAlive: new Uint8Array(MAX_ENEMIES),
    enemyState: new Int8Array(MAX_ENEMIES),
    enemyTimer: new Float32Array(MAX_ENEMIES),
    enemyPlat: new Int32Array(MAX_ENEMIES),
    enemyOffsetX: new Float32Array(MAX_ENEMIES),
    enemyFacing: new Float32Array(MAX_ENEMIES),
    enemyPhase: new Float32Array(MAX_ENEMIES),
    enemyDeathVX: new Float32Array(MAX_ENEMIES),
    enemyDeathVY: new Float32Array(MAX_ENEMIES),

    flyAlive: new Uint8Array(MAX_FLYERS),
    flyKind: new Int8Array(MAX_FLYERS),
    flyStartX: new Float32Array(MAX_FLYERS),
    flyStartY: new Float32Array(MAX_FLYERS),
    flyTargetX: new Float32Array(MAX_FLYERS),
    flyTargetY: new Float32Array(MAX_FLYERS),
    flyElapsed: new Float32Array(MAX_FLYERS),

    fxAlive: new Uint8Array(MAX_DEATH_FX),
    fxX: new Float32Array(MAX_DEATH_FX),
    fxY: new Float32Array(MAX_DEATH_FX),
    fxElapsed: new Float32Array(MAX_DEATH_FX),
    fxSeed: new Float32Array(MAX_DEATH_FX),

    dustAlive: new Uint8Array(MAX_DUST),
    dustX: new Float32Array(MAX_DUST),
    dustY: new Float32Array(MAX_DUST),
    dustElapsed: new Float32Array(MAX_DUST),
    dustSeed: new Float32Array(MAX_DUST),
  };

  resetRun(state, 1);
  return state;
}


/** Height climbed this run, in metres, for the HUD. */
export function heightInMeters(state: GameState, pixelsPerMeter: number): number {
  'worklet';
  return Math.max(0, (state.startY - state.peakY) / pixelsPerMeter);
}
