import {
  CRYSTAL_SHARE,
  DESIGN_WIDTH,
  DESPAWN_BELOW,
  ENEMY_CHANCE,
  ENEMY_FREE_HEIGHT,
  ENEMY_TYPE_WEIGHTS,
  BASE_JUMP_HEIGHT,
  GAP_MAX_RATIO,
  GAP_MIN_RATIO,
  LIFE_CHANCE,
  MAX_ENEMIES,
  MAX_PICKUPS,
  MAX_PLATFORMS,
  MAX_SPAWN_DX,
  MOVING_PLATFORM_RANGE,
  PICKUP_CHANCE,
  PICKUP_HEIGHT,
  SPAWN_AHEAD,
} from '@/game/constants';
import { nextRandom, randomRange } from '@/game/rng';
import {
  EnemyState,
  type EnemyTypeValue,
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
 * ledges or the skyline turns into a brick wall. Spikes is rarer still — it's a
 * hazard, not scenery, and should read as a surprise, not a fixture.
 */
const TYPE_WEIGHTS = [11, 18, 20, 13, 10, 10, 0, 6, 6, 6, 5];
const TOTAL_WEIGHT = 105;

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

function allocEnemy(state: GameState): number {
  'worklet';
  for (let i = 0; i < MAX_ENEMIES; i += 1) {
    if (state.enemyAlive[i] === 0) return i;
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

const ENEMY_TOTAL_WEIGHT = ENEMY_TYPE_WEIGHTS.reduce((sum, w) => sum + w, 0);

function pickEnemyType(state: GameState): EnemyTypeValue {
  'worklet';
  let roll = nextRandom(state) * ENEMY_TOTAL_WEIGHT;
  for (let i = 0; i < ENEMY_TYPE_WEIGHTS.length; i += 1) {
    roll -= ENEMY_TYPE_WEIGHTS[i];
    if (roll <= 0) return i as EnemyTypeValue;
  }
  return 0 as EnemyTypeValue;
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

  // Spikes never lands two rows in a row — reroll until a non-hazard type
  // comes up, capped so a pathological RNG streak can't loop forever.
  let type = pickPlatformType(state);
  if (state.lastPlatformWasSpikes) {
    let attempts = 0;
    while (type === PlatformType.Spikes && attempts < 10) {
      type = pickPlatformType(state);
      attempts += 1;
    }
  }
  state.lastPlatformWasSpikes = type === PlatformType.Spikes ? 1 : 0;

  const spec = PLATFORM_SPECS[type];
  const freeWidth = Math.max(0, DESIGN_WIDTH - spec.w);
  const y = surfaceY - Math.min(spec.surfaceY, spec.surfaceRightY);

  state.platType[index] = type;
  state.platY[index] = y;
  state.platAlive[index] = 1;
  state.platPhase[index] = randomRange(state, 0, Math.PI * 2);

  // Keep this row's platform within MAX_SPAWN_DX of the row below it, centre to
  // centre — see the constant's comment for why this stopped being optional once
  // the jump apex sits this close to the gap ceiling. Falls back to the row's own
  // centre if the window and the screen edges leave nothing in common (only
  // possible for the widest platform paired with a tiny MAX_SPAWN_DX).
  const halfW = spec.w / 2;
  const minCentre = Math.max(halfW, state.lastSpawnX - MAX_SPAWN_DX);
  const maxCentre = Math.min(DESIGN_WIDTH - halfW, state.lastSpawnX + MAX_SPAWN_DX);
  const rowCentre = minCentre <= maxCentre ? randomRange(state, minCentre, maxCentre) : DESIGN_WIDTH / 2;
  const baseX = Math.min(freeWidth, Math.max(0, rowCentre - halfW));

  if (spec.behaviour === PlatformBehaviour.Moving) {
    // Amplitude is capped by whichever screen edge is closer, so a moving
    // platform anchored near either side still never slides off-screen.
    const range = Math.min(baseX, freeWidth - baseX) * MOVING_PLATFORM_RANGE;
    state.platBaseX[index] = baseX;
    state.platRange[index] = range;
    state.platX[index] = baseX + Math.sin(state.platPhase[index]) * range;
  } else {
    state.platBaseX[index] = baseX;
    state.platRange[index] = 0;
    state.platX[index] = baseX;
  }

  state.lastSpawnX = baseX + halfW;

  // Spikes is a hazard and nothing else — it never carries an enemy to fight
  // on it or a pickup dangling as bait over it, unlike every other type below.
  if (type === PlatformType.Spikes) return;

  // Enemies: never on the opening platform or on Bouncy (you cannot stand and
  // fight where landing itself relaunches you), and not until the run has
  // climbed clear of its opening stretch. Mutually exclusive with the row's
  // pickup roll below — a platform is either defended or worth something, never
  // both, so a life never spawns for free next to something guarding it.
  const canHostEnemy =
    type !== PlatformType.Start &&
    type !== PlatformType.Bouncy &&
    surfaceY <= state.startY - ENEMY_FREE_HEIGHT;

  if (canHostEnemy && nextRandom(state) < ENEMY_CHANCE) {
    const enemyIndex = allocEnemy(state);
    if (enemyIndex !== -1) {
      state.enemyType[enemyIndex] = pickEnemyType(state);
      state.enemyAlive[enemyIndex] = 1;
      state.enemyState[enemyIndex] = EnemyState.Idle;
      state.enemyTimer[enemyIndex] = 0;
      state.enemyPlat[enemyIndex] = index;
      state.enemyOffsetX[enemyIndex] = spec.w / 2;
      state.enemyFacing[enemyIndex] = 1;
      state.enemyPhase[enemyIndex] = randomRange(state, 0, Math.PI * 2);
      // Placeholder until the next `stepEnemies` call recomputes it from the
      // platform's actual surface — nothing reads it before then.
      state.enemyX[enemyIndex] = state.platX[index] + spec.w / 2;
      state.enemyY[enemyIndex] = surfaceY;
    }
    return;
  }

  if (nextRandom(state) >= PICKUP_CHANCE) {
    // No regular pickup this row — a separate, rarer roll for a life, only
    // while under the cap. A life at full health would be a wasted drop.
    if (state.lives >= state.maxLives || nextRandom(state) >= LIFE_CHANCE) return;

    const lifeIndex = allocPickup(state);
    if (lifeIndex === -1) return;

    state.pickX[lifeIndex] = state.platX[index] + spec.w / 2;
    state.pickY[lifeIndex] = surfaceY - PICKUP_HEIGHT * 1.6;
    state.pickType[lifeIndex] = PickupType.Life;
    state.pickAlive[lifeIndex] = 1;
    state.pickPhase[lifeIndex] = randomRange(state, 0, Math.PI * 2);
    return;
  }

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
 * Gaps are a fraction of `BASE_JUMP_HEIGHT`, which is itself derived from gravity
 * and the level-0 jump impulse — so retuning either can never leave behind a
 * level with an unreachable gap. Deliberately the base jump, not the upgraded
 * one; see BASE_JUMP_HEIGHT's own comment.
 */
export function spawnAhead(state: GameState) {
  'worklet';
  const horizon = state.camY - SPAWN_AHEAD;
  while (state.nextSpawnY > horizon) {
    spawnRow(state, state.nextSpawnY);
    state.nextSpawnY -= randomRange(
      state,
      BASE_JUMP_HEIGHT * GAP_MIN_RATIO,
      BASE_JUMP_HEIGHT * GAP_MAX_RATIO
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

  // Platforms are recycled above first, so an enemy whose ride just vanished is
  // caught in the same pass rather than lingering a frame until `stepEnemies`
  // notices on its own.
  for (let i = 0; i < MAX_ENEMIES; i += 1) {
    if (state.enemyAlive[i] === 0) continue;
    if (state.enemyY[i] > limit || state.platAlive[state.enemyPlat[i]] === 0) {
      state.enemyAlive[i] = 0;
    }
  }
}
