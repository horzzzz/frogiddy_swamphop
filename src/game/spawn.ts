import {
  CRYSTAL_SHARE,
  DESIGN_WIDTH,
  DESPAWN_BELOW,
  GAP_MAX_RATIO,
  GAP_MIN_RATIO,
  MAX_JUMP_HEIGHT,
  MAX_PICKUPS,
  MAX_PLATFORMS,
  MOVING_PLATFORM_RANGE,
  PICKUP_CHANCE,
  PICKUP_HEIGHT,
  SPAWN_AHEAD,
} from '@/game/constants';
import { nextRandom, randomRange } from '@/game/rng';
import {
  PLATFORM_SPECS,
  PickupType,
  PlatformBehaviour,
  PlatformType,
  type GameState,
  type PlatformTypeValue,
} from '@/game/types';

/**
 * Relative frequency of each platform type, indexed by PlatformType. `Start` is
 * never generated — it exists only as the opening platform placed by `resetRun`.
 * Wall, slope and corner are chunky masonry, so they stay rarer than the plain
 * ledges or the skyline turns into a brick wall.
 */
const TYPE_WEIGHTS = [11, 18, 20, 13, 10, 10, 0, 6, 6, 6];
const TOTAL_WEIGHT = 100;

function allocPlatform(state: GameState): number {
  'worklet';
  for (let i = 0; i < MAX_PLATFORMS; i += 1) {
    if (state.platAlive[i] === 0) return i;
  }
  return -1;
}

function allocPickup(state: GameState): number {
  'worklet';
  for (let i = 0; i < MAX_PICKUPS; i += 1) {
    if (state.pickAlive[i] === 0) return i;
  }
  return -1;
}

function pickPlatformType(state: GameState): PlatformTypeValue {
  'worklet';
  let roll = nextRandom(state) * TOTAL_WEIGHT;
  for (let i = 0; i < TYPE_WEIGHTS.length; i += 1) {
    roll -= TYPE_WEIGHTS[i];
    if (roll <= 0) return i as PlatformTypeValue;
  }
  return PlatformType.Small;
}

/**
 * Places one platform so that its highest standable point lands on `surfaceY`.
 *
 * Gaps are measured surface to surface, not sprite-top to sprite-top: the bouncy
 * cap sits 12 units below its sprite's top edge and the slope's low end 71, so
 * spawning by sprite top would quietly inflate some gaps past what a jump can
 * clear.
 */
function spawnRow(state: GameState, surfaceY: number) {
  'worklet';
  const index = allocPlatform(state);
  if (index === -1) return;

  const type = pickPlatformType(state);
  const spec = PLATFORM_SPECS[type];
  const freeWidth = Math.max(0, DESIGN_WIDTH - spec.w);
  const y = surfaceY - Math.min(spec.surfaceY, spec.surfaceRightY);

  state.platType[index] = type;
  state.platY[index] = y;
  state.platAlive[index] = 1;
  state.platPhase[index] = randomRange(state, 0, Math.PI * 2);

  if (spec.behaviour === PlatformBehaviour.Moving) {
    // Moving platforms swing about the centre of the row so they never slide
    // off-screen at the extremes of their travel.
    const centre = freeWidth / 2;
    const range = centre * MOVING_PLATFORM_RANGE;
    state.platBaseX[index] = centre;
    state.platRange[index] = range;
    state.platX[index] = centre + Math.sin(state.platPhase[index]) * range;
  } else {
    const x = randomRange(state, 0, freeWidth);
    state.platBaseX[index] = x;
    state.platRange[index] = 0;
    state.platX[index] = x;
  }

  if (nextRandom(state) >= PICKUP_CHANCE) return;

  const pickupIndex = allocPickup(state);
  if (pickupIndex === -1) return;

  state.pickX[pickupIndex] = state.platX[index] + spec.w / 2;
  state.pickY[pickupIndex] = surfaceY - PICKUP_HEIGHT * 1.6;
  state.pickType[pickupIndex] =
    nextRandom(state) < CRYSTAL_SHARE ? PickupType.Crystal : PickupType.Coin;
  state.pickAlive[pickupIndex] = 1;
  state.pickPhase[pickupIndex] = randomRange(state, 0, Math.PI * 2);
}

/**
 * Generates platforms until the level is filled to `SPAWN_AHEAD` above the camera.
 *
 * Gaps are a fraction of `MAX_JUMP_HEIGHT`, which is itself derived from gravity
 * and jump impulse — so retuning the jump can never leave behind a level with an
 * unreachable gap.
 */
export function spawnAhead(state: GameState) {
  'worklet';
  const horizon = state.camY - SPAWN_AHEAD;
  while (state.nextSpawnY > horizon) {
    spawnRow(state, state.nextSpawnY);
    state.nextSpawnY -= randomRange(
      state,
      MAX_JUMP_HEIGHT * GAP_MIN_RATIO,
      MAX_JUMP_HEIGHT * GAP_MAX_RATIO
    );
  }
}

/** Returns everything that has fallen well below the screen to its pool. */
export function recycleBelow(state: GameState) {
  'worklet';
  const limit = state.camY + state.viewH + DESPAWN_BELOW;

  for (let i = 0; i < MAX_PLATFORMS; i += 1) {
    if (state.platAlive[i] === 0) continue;
    // Never recycle the platform underfoot — its index is still referenced.
    if (i === state.groundedIndex) continue;
    if (state.platY[i] > limit) state.platAlive[i] = 0;
  }

  for (let i = 0; i < MAX_PICKUPS; i += 1) {
    if (state.pickAlive[i] === 0) continue;
    if (state.pickY[i] > limit) state.pickAlive[i] = 0;
  }
}
