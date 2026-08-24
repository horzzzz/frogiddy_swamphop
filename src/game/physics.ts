import {
  AIM_MAX_ANGLE,
  AIM_MAX_DRAG,
  AIM_MIN_DRAG,
  AIR_DRAG_PER_SECOND,
  BOUNCY_MULTIPLIER,
  DESIGN_WIDTH,
  FROG_HALF_H,
  FROG_HALF_W,
  FROG_HURT_INVULN,
  GRAVITY,
  MAX_ENEMIES,
  MAX_FALL_SPEED,
  MAX_PICKUPS,
  MAX_PLATFORMS,
  MOVING_PLATFORM_SPEED,
  PICKUP_RADIUS,
  STOMP_BOUNCE,
} from '@/game/constants';
import { clearTongue, killEnemy } from '@/game/state';
import {
  ENEMY_SPECS,
  EnemyState,
  FrogState,
  PLATFORM_SPECS,
  PickupType,
  PlatformBehaviour,
  type GameState,
  type PlatformSpec,
} from '@/game/types';

/** Keeps X inside the play field. The world wraps horizontally, Doodle Jump style. */
export function wrapX(x: number): number {
  'worklet';
  return ((x % DESIGN_WIDTH) + DESIGN_WIDTH) % DESIGN_WIDTH;
}

/** Shortest signed X distance from `from` to `to`, going around the wrap seam if that is closer. */
export function wrappedDeltaX(from: number, to: number): number {
  'worklet';
  let dx = to - from;
  if (dx > DESIGN_WIDTH / 2) dx -= DESIGN_WIDTH;
  else if (dx < -DESIGN_WIDTH / 2) dx += DESIGN_WIDTH;
  return dx;
}

/**
 * Surface height of a platform at a given X (already resolved onto the
 * platform's own, unwrapped number line). Flat for most platforms; ramps
 * linearly across `surfaceRamp` of the width for the sloped one.
 *
 * Shared by the frog's own collision sweep and by the tongue's hit test, so a
 * grapple always snaps to exactly the surface a normal landing would.
 */
export function surfaceYAt(
  spec: PlatformSpec,
  platY: number,
  x: number,
  left: number,
  right: number
): number {
  'worklet';
  if (spec.surfaceRightY === spec.surfaceY || right <= left) return platY + spec.surfaceY;
  const along = (x - left) / (right - left);
  const ramped = Math.min(1, Math.max(0, along / spec.surfaceRamp));
  return platY + spec.surfaceY + (spec.surfaceRightY - spec.surfaceY) * ramped;
}

/**
 * Turns a raw finger drag into a clamped launch direction and power, stored on the
 * state. Both the trajectory preview and the actual launch read these fields, so
 * what the player is shown and what they get cannot drift apart.
 */
export function applyAim(state: GameState, dragX: number, dragY: number) {
  'worklet';
  // Slingshot: the frog launches opposite the pull.
  const dx = -dragX;
  const dy = -dragY;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length < AIM_MIN_DRAG) {
    state.aiming = false;
    state.aimPower = 0;
    return;
  }

  // Clamp into an upward cone so a stray sideways drag cannot fire the frog off
  // the screen horizontally, or downward into an instant death.
  const angleFromUp = Math.atan2(dx / length, -dy / length);
  const clamped = Math.max(-AIM_MAX_ANGLE, Math.min(AIM_MAX_ANGLE, angleFromUp));

  state.aimDX = Math.sin(clamped);
  state.aimDY = -Math.cos(clamped);
  state.aimPower = Math.min(1, (length - AIM_MIN_DRAG) / (AIM_MAX_DRAG - AIM_MIN_DRAG));
  state.aiming = true;
}

/** Converts the current aim into velocity and lifts the frog off its platform. */
export function launchFrog(state: GameState) {
  'worklet';
  const impulse = state.jumpImpulseMin + (state.jumpImpulseMax - state.jumpImpulseMin) * state.aimPower;

  state.frogVX = state.aimDX * impulse;
  state.frogVY = state.aimDY * impulse;
  state.grounded = false;
  state.groundedIndex = -1;
  state.frogState = FrogState.Jump;
  state.tongueUsedThisFlight = false;

  if (state.aimDX > 0.05) state.frogFacing = 1;
  else if (state.aimDX < -0.05) state.frogFacing = -1;

  state.aiming = false;
  state.aimPower = 0;
}

/**
 * Seats the frog on a platform. Shared by the collision sweep and by the tongue,
 * so a grapple onto a bouncy platform bounces exactly like a landing does.
 */
export function land(state: GameState, index: number, surfaceY: number) {
  'worklet';
  state.frogY = surfaceY - FROG_HALF_H;
  clearTongue(state);
  state.tongueUsedThisFlight = false;

  if (PLATFORM_SPECS[state.platType[index]].behaviour === PlatformBehaviour.Bouncy) {
    // Bouncy platforms relaunch on contact rather than letting you aim again —
    // that is the whole point of "Bouncy higher" in the tutorial.
    state.frogVY = -state.jumpImpulseMax * BOUNCY_MULTIPLIER;
    state.grounded = false;
    state.groundedIndex = -1;
    state.frogState = FrogState.Jump;
    return;
  }

  state.frogVX = 0;
  state.frogVY = 0;
  state.grounded = true;
  state.groundedIndex = index;
  state.frogState = FrogState.Idle;
}

/**
 * Applies one enemy hit. A no-op while i-frames are still running, so a windup
 * that somehow lands during the flash cannot stack damage.
 *
 * Deliberately does not touch velocity or position: getting hit knocks nothing
 * back. A shove on a narrow platform would turn "took a hit" into "fell off",
 * which punishes the player twice for one mistake.
 */
export function damageFrog(state: GameState) {
  'worklet';
  if (state.hurtTimer > 0 || state.frogState === FrogState.Dead) return;

  state.lives -= 1;
  state.hurtTimer = FROG_HURT_INVULN;

  if (state.lives <= 0) {
    state.frogState = FrogState.Dead;
    state.running = false;
  }
}

/**
 * Advances every moving platform, carrying a frog that is riding one.
 *
 * Runs before the frog's own integration so a passenger never lags a frame
 * behind its ride.
 */
export function stepMovingPlatforms(state: GameState, dt: number) {
  'worklet';
  for (let i = 0; i < MAX_PLATFORMS; i += 1) {
    if (state.platAlive[i] === 0) continue;
    if (PLATFORM_SPECS[state.platType[i]].behaviour !== PlatformBehaviour.Moving) continue;

    const previousX = state.platX[i];
    state.platPhase[i] += dt * MOVING_PLATFORM_SPEED;
    const nextX = state.platBaseX[i] + Math.sin(state.platPhase[i]) * state.platRange[i];
    state.platX[i] = nextX;

    if (state.grounded && state.groundedIndex === i) {
      state.frogX = wrapX(state.frogX + (nextX - previousX));
    }
  }

}

/** Gravity, integration and one-way platform collision for the frog itself. */
export function stepFrog(state: GameState, dt: number) {
  'worklet';
  if (state.frogState === FrogState.Dead) return;

  if (state.grounded) {
    // A grounded frog is inert until the slingshot fires; no gravity, no drift.
    state.frogVY = 0;
    return;
  }

  const previousBottom = state.frogY + FROG_HALF_H;

  state.frogVY = Math.min(state.frogVY + GRAVITY * dt, MAX_FALL_SPEED);
  state.frogVX -= state.frogVX * AIR_DRAG_PER_SECOND * dt;
  state.frogX = wrapX(state.frogX + state.frogVX * dt);
  state.frogY += state.frogVY * dt;

  state.frogState = state.frogVY < 0 ? FrogState.Jump : FrogState.Fall;
  if (state.frogVX > 8) state.frogFacing = 1;
  else if (state.frogVX < -8) state.frogFacing = -1;

  if (state.frogY < state.peakY) state.peakY = state.frogY;

  // One-way platforms: only a descending frog collides, and only if its feet
  // crossed the surface plane during this step. Comparing against the previous
  // position rather than testing overlap is what stops fast falls tunnelling
  // straight through a thin platform.
  if (state.frogVY <= 0) return;
  const bottom = state.frogY + FROG_HALF_H;

  // Stomp: a falling frog whose feet crossed an enemy's head plane this step
  // kills it and bounces off, exactly like the one-way platform sweep below but
  // checked first — a stomp and a landing can never both resolve for the same
  // step. Comparing against the previous position, not overlap, for the same
  // tunnelling reason the platform sweep does.
  for (let i = 0; i < MAX_ENEMIES; i += 1) {
    if (state.enemyAlive[i] === 0 || state.enemyState[i] === EnemyState.Dying) continue;

    const spec = ENEMY_SPECS[state.enemyType[i]];
    const dx = wrappedDeltaX(state.enemyX[i], state.frogX);
    if (Math.abs(dx) > FROG_HALF_W + spec.w / 2) continue;

    const headY = state.enemyY[i] - spec.halfH;
    if (previousBottom > headY || bottom < headY) continue;

    killEnemy(state, i);
    state.frogVY = -STOMP_BOUNCE;
    state.frogState = FrogState.Jump;
    state.tongueUsedThisFlight = false;
    return;
  }

  let hitIndex = -1;
  let hitSurface = 0;

  for (let i = 0; i < MAX_PLATFORMS; i += 1) {
    if (state.platAlive[i] === 0) continue;

    const spec = PLATFORM_SPECS[state.platType[i]];
    const left = state.platX[i] + spec.insetX;
    const right = state.platX[i] + spec.w - spec.insetX;

    // Which wrapped copy of the frog is over this platform? We need the actual
    // overlapping X, not just a yes/no, because a sloped surface's height
    // depends on where along the platform the frog is standing.
    let overlapX = 0;
    let overlaps = false;
    for (let k = -1; k <= 1; k += 1) {
      const candidate = state.frogX + k * DESIGN_WIDTH;
      if (candidate + FROG_HALF_W > left && candidate - FROG_HALF_W < right) {
        overlapX = candidate;
        overlaps = true;
        break;
      }
    }
    if (!overlaps) continue;

    const surfaceY = surfaceYAt(spec, state.platY[i], overlapX, left, right);
    if (previousBottom > surfaceY || bottom < surfaceY) continue;

    // Several platforms can be crossed in one step; the frog stops at the
    // highest of them, which is the one it would have reached first.
    if (hitIndex === -1 || surfaceY < hitSurface) {
      hitIndex = i;
      hitSurface = surfaceY;
    }
  }

  if (hitIndex !== -1) land(state, hitIndex, hitSurface);
}

/** Removes any pickup the frog is touching and banks it into the run totals. */
export function collectPickups(state: GameState) {
  'worklet';
  for (let i = 0; i < MAX_PICKUPS; i += 1) {
    if (state.pickAlive[i] === 0) continue;

    const dy = state.pickY[i] - state.frogY;
    if (dy > PICKUP_RADIUS || dy < -PICKUP_RADIUS) continue;

    const dx = wrappedDeltaX(state.frogX, state.pickX[i]);
    if (dx * dx + dy * dy > PICKUP_RADIUS * PICKUP_RADIUS) continue;

    state.pickAlive[i] = 0;
    if (state.pickType[i] === PickupType.Crystal) state.crystals += 1;
    else if (state.pickType[i] === PickupType.Life) {
      state.lives = Math.min(state.maxLives, state.lives + 1);
    } else state.coins += 1;
  }
}

/** Ends the run once the frog has fallen a full screen below the camera. */
export function checkDeath(state: GameState) {
  'worklet';
  if (state.frogState === FrogState.Dead) return;
  if (state.frogY - FROG_HALF_H > state.camY + state.viewH) {
    state.frogState = FrogState.Dead;
    state.running = false;
  }
}
