import {
  ENEMY_AGGRO_RANGE_X,
  ENEMY_AGGRO_RANGE_Y,
  ENEMY_ATTACK_COOLDOWN,
  ENEMY_WINDUP,
  MAX_ENEMIES,
} from '@/game/constants';
import { damageFrog, surfaceYAt, wrapX, wrappedDeltaX } from '@/game/physics';
import { ENEMY_SPECS, EnemyState, PLATFORM_SPECS, type GameState } from '@/game/types';

/**
 * True while the frog sits within an enemy's aggro/attack radius — grounded or
 * airborne alike. The old `grounded` gate made sense when standing still was
 * the frog's normal state; now that a landing launches on its own, gating
 * aggro on it would leave enemies unable to ever wind up.
 */
function frogInRange(state: GameState, enemyX: number, enemyY: number): boolean {
  'worklet';
  const dx = wrappedDeltaX(enemyX, state.frogX);
  const dy = state.frogY - enemyY;
  return Math.abs(dx) <= ENEMY_AGGRO_RANGE_X && Math.abs(dy) <= ENEMY_AGGRO_RANGE_Y;
}

/**
 * Advances every enemy: rides its platform, watches for the frog to come into
 * range to aggro onto, telegraphs, hits, recovers. Also ticks the frog's i-frames —
 * `stepFrog` returns early while grounded (a resting frog has nothing to
 * integrate), so no per-frame timer can live there. This runs unconditionally
 * every step, so it is the one safe place for it.
 */
export function stepEnemies(state: GameState, dt: number) {
  'worklet';
  if (state.hurtTimer > 0) state.hurtTimer = Math.max(0, state.hurtTimer - dt);

  for (let i = 0; i < MAX_ENEMIES; i += 1) {
    if (state.enemyAlive[i] === 0) continue;

    // A dying corpse no longer rides its platform — it flies off on its own
    // knockback velocity (zero for a stomp kill, set by `killEnemy` for a
    // melee one) instead of being snapped back onto the platform's surface
    // every frame like a living enemy is below. It also outlives its platform
    // recycling out from under it during the brief linger, which a living
    // enemy does not.
    if (state.enemyState[i] === EnemyState.Dying) {
      state.enemyTimer[i] -= dt;
      if (state.enemyTimer[i] <= 0) {
        state.enemyAlive[i] = 0;
        continue;
      }
      state.enemyX[i] = wrapX(state.enemyX[i] + state.enemyDeathVX[i] * dt);
      state.enemyY[i] += state.enemyDeathVY[i] * dt;
      continue;
    }

    // Its platform can have recycled or otherwise vanished under it — same
    // defensive check the tongue does when its anchor platform disappears.
    const plat = state.enemyPlat[i];
    if (plat < 0 || state.platAlive[plat] === 0) {
      state.enemyAlive[i] = 0;
      continue;
    }

    const spec = PLATFORM_SPECS[state.platType[plat]];
    const left = state.platX[plat] + spec.insetX;
    const right = state.platX[plat] + spec.w - spec.insetX;
    const enemyX = wrapX(state.platX[plat] + state.enemyOffsetX[i]);
    const enemySpec = ENEMY_SPECS[state.enemyType[i]];
    state.enemyX[i] = enemyX;
    state.enemyY[i] = surfaceYAt(spec, state.platY[plat], enemyX, left, right) - enemySpec.halfH;

    const phase = state.enemyState[i];

    if (phase === EnemyState.Idle) {
      if (frogInRange(state, state.enemyX[i], state.enemyY[i])) {
        state.enemyFacing[i] = wrappedDeltaX(state.enemyX[i], state.frogX) >= 0 ? 1 : -1;
        state.enemyState[i] = EnemyState.WindUp;
        state.enemyTimer[i] = ENEMY_WINDUP;
      }
      continue;
    }

    if (phase === EnemyState.WindUp) {
      state.enemyTimer[i] -= dt;
      if (state.enemyTimer[i] <= 0) {
        // The telegraph always completes once started — it does not cancel if
        // the frog jumps away, so a well-timed dodge is what saves you, not a
        // change of mind on the enemy's part. Re-checking range here only
        // decides whether the completed attack actually connects.
        if (frogInRange(state, state.enemyX[i], state.enemyY[i])) damageFrog(state);
        state.enemyState[i] = EnemyState.Recover;
        state.enemyTimer[i] = ENEMY_ATTACK_COOLDOWN;
      }
      continue;
    }

    // Recover.
    state.enemyTimer[i] -= dt;
    if (state.enemyTimer[i] <= 0) state.enemyState[i] = EnemyState.Idle;
  }
}
