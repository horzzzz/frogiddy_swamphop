import {
  BOUNCY_MULTIPLIER,
  COIN_PICKUP_VALUE,
  DEATH_FX_DURATION,
  DESIGN_WIDTH,
  DUST_DURATION,
  DUST_MIN_SPEED,
  FLY_DURATION,
  FROG_HALF_H,
  FROG_HALF_W,
  FROG_HURT_INVULN,
  GRAVITY,
  MAX_DEATH_FX,
  MAX_DUST,
  MAX_ENEMIES,
  MAX_FALL_SPEED,
  MAX_FLYERS,
  MAX_PICKUPS,
  MAX_PLATFORMS,
  MOVE_SPEED_MAX,
  MOVING_PLATFORM_SPEED,
  PICKUP_RADIUS,
  SFX_DAMAGE,
  SFX_LAND,
  SFX_PICKUP,
  STOMP_BOUNCE_MULTIPLIER,
  WALL_CLING_GRACE,
  WALL_DETACH_AXIS,
  WALL_SLIDE_ACCEL,
  WALL_SLIDE_SPEED,
} from '@/game/constants';
import { clearTongue, killEnemy, spawnDust, spawnFlyer } from '@/game/state';
import {
  ENEMY_SPECS,
  EnemyState,
  FrogState,
  PLATFORM_SPECS,
  PickupType,
  type PickupTypeValue,
  PlatformBehaviour,
  type GameState,
  type PlatformSpec,
} from '@/game/types';

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
 * Fires the automatic Doodle-Jump launch: called once, on the physics step
 * right after a grounded frog is detected (see `advance` in step.ts), so
 * `grounded` never survives more than a single fixed step. Purely vertical —
 * horizontal motion belongs to the move joystick, which `stepFrog` applies
 * every step regardless of whether the frog is rising or falling.
 */
export function launchAutoJump(state: GameState) {
  'worklet';
  state.frogVY = -state.autoJumpImpulse;
  state.grounded = false;
  state.groundedIndex = -1;
  state.frogState = FrogState.Jump;
  state.tongueUsedThisFlight = false;
}

/**
 * Seats the frog on a platform. Shared by the collision sweep and by the tongue,
 * so a grapple onto a bouncy platform bounces exactly like a landing does.
 */
export function land(state: GameState, index: number, surfaceY: number) {
  'worklet';
  // Read before anything below zeroes it. Speed is a threshold here, not a
  // dial: a gentle settle raises neither dust nor sound, and everything above
  // that line gets the identical puff. Putting it here rather than in the two
  // callers is what keeps the collision sweep and a tongue grapple announcing a
  // landing the same way.
  if (state.frogVY >= DUST_MIN_SPEED) {
    spawnDust(state, state.frogX, surfaceY, state.elapsed);
    state.sfxFlags |= SFX_LAND;
  }

  state.frogY = surfaceY - FROG_HALF_H;
  clearTongue(state);
  state.tongueUsedThisFlight = false;

  if (PLATFORM_SPECS[state.platType[index]].behaviour === PlatformBehaviour.Bouncy) {
    // Bouncy platforms relaunch on contact rather than waiting for the next
    // auto-jump — that is the whole point of "Bouncy higher" in the tutorial.
    state.frogVY = -state.autoJumpImpulse * BOUNCY_MULTIPLIER;
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
 * Seats the frog against a world edge. The X/Y counterpart to `land` — shared
 * by the collision check in `stepFrog` and by the tongue's Pulling phase, so
 * flying into a wall and lassoing yourself onto one end the same way.
 *
 * Deliberately does not touch `frogY`: unlike a platform, a wall has no
 * surface to snap to, so the frog stays exactly where it was vertically and
 * `stepWallCling` takes it from there.
 */
export function clingToWall(state: GameState, side: number) {
  'worklet';
  state.frogX = side < 0 ? FROG_HALF_W : DESIGN_WIDTH - FROG_HALF_W;
  state.frogVX = 0;
  state.frogVY = 0;
  state.frogState = FrogState.WallCling;
  state.frogFacing = -side;
  state.wallSide = side;
  state.wallTimer = WALL_CLING_GRACE;
  state.grounded = false;
  state.groundedIndex = -1;
  clearTongue(state);
  state.tongueUsedThisFlight = false;
}

/**
 * Advances a wall-cling: frozen for `WALL_CLING_GRACE`, then a slide that ramps
 * up to `WALL_SLIDE_SPEED` — slower than a free fall on purpose, so clinging
 * reads as a reprieve worth using rather than just a delayed death. Leaning the
 * move joystick away from the wall past `WALL_DETACH_AXIS` lets go early, back
 * into an ordinary fall; `stepFrog` picks the frog back up the moment
 * `frogState` stops being WallCling.
 */
export function stepWallCling(state: GameState, dt: number) {
  'worklet';
  const leaningAway = state.wallSide < 0 ? state.moveAxis > WALL_DETACH_AXIS : state.moveAxis < -WALL_DETACH_AXIS;
  if (leaningAway) {
    state.frogState = FrogState.Fall;
    state.wallSide = 0;
    return;
  }

  if (state.wallTimer > 0) {
    state.wallTimer = Math.max(0, state.wallTimer - dt);
    return;
  }

  state.frogVY = Math.min(state.frogVY + WALL_SLIDE_ACCEL * dt, WALL_SLIDE_SPEED);
  state.frogY += state.frogVY * dt;
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
  state.sfxFlags |= SFX_DAMAGE;

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
      state.frogX += nextX - previousX;
    }
  }

}

/** Gravity, integration and one-way platform collision for the frog itself. */
export function stepFrog(state: GameState, dt: number) {
  'worklet';
  if (state.frogState === FrogState.Dead) return;

  if (state.grounded) {
    // Reached two ways: the very first substep after `resetRun` (before
    // `advance` has had a chance to see a grounded frog and auto-jump it),
    // and — every time — the same substep a tongue-pull lands. `stepTongue`'s
    // Pulling phase calls `land` directly, which can set `grounded` mid-substep
    // after `advance`'s own `launchAutoJump` check already ran for this step;
    // this is what stops the frog falling through the platform it just landed
    // on for the rest of that step. `advance` un-grounds it via `launchAutoJump`
    // at the top of the *next* substep either way, so this never lasts more
    // than one step.
    state.frogVY = 0;
    return;
  }

  const previousBottom = state.frogY + FROG_HALF_H;

  state.frogVY = Math.min(state.frogVY + GRAVITY * dt, MAX_FALL_SPEED);
  // No drag, no acceleration: the move joystick is a direct speed control, not
  // a force, so the frog's horizontal position is always exactly where the
  // stick says it should be.
  state.frogVX = state.moveAxis * MOVE_SPEED_MAX;
  state.frogY += state.frogVY * dt;
  if (state.frogY < state.peakY) state.peakY = state.frogY;

  // World edges cling rather than wrap now that the camera can be zoomed in
  // close enough that the far edge is off-screen — see `clingToWall`. Checked
  // before committing the X move, and returns immediately: a frog that hits a
  // wall this step cannot also land on a platform or stomp an enemy the same
  // step, the same way a stomp already pre-empts a landing below.
  const nextX = state.frogX + state.frogVX * dt;
  if (nextX < FROG_HALF_W) {
    clingToWall(state, -1);
    return;
  }
  if (nextX > DESIGN_WIDTH - FROG_HALF_W) {
    clingToWall(state, 1);
    return;
  }
  state.frogX = nextX;

  state.frogState = state.frogVY < 0 ? FrogState.Jump : FrogState.Fall;
  if (state.frogVX > 8) state.frogFacing = 1;
  else if (state.frogVX < -8) state.frogFacing = -1;

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
    const dx = state.frogX - state.enemyX[i];
    if (Math.abs(dx) > FROG_HALF_W + spec.w / 2) continue;

    const headY = state.enemyY[i] - spec.halfH;
    if (previousBottom > headY || bottom < headY) continue;

    killEnemy(state, i);
    state.frogVY = -state.autoJumpImpulse * STOMP_BOUNCE_MULTIPLIER;
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

    if (state.frogX + FROG_HALF_W <= left || state.frogX - FROG_HALF_W >= right) continue;

    const surfaceY = surfaceYAt(spec, state.platY[i], state.frogX, left, right);
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

    const dx = state.pickX[i] - state.frogX;
    if (dx * dx + dy * dy > PICKUP_RADIUS * PICKUP_RADIUS) continue;

    state.pickAlive[i] = 0;
    state.sfxFlags |= SFX_PICKUP;
    if (state.pickType[i] === PickupType.Crystal) state.crystals += 1;
    else if (state.pickType[i] === PickupType.Life) {
      state.lives = Math.min(state.maxLives, state.lives + 1);
    } else state.coins += COIN_PICKUP_VALUE;

    // `spawnFlyer` freezes a screen-space start point for a HUD-relative flight
    // (see its own doc comment), so the world position has to be run through
    // the same camera-and-zoom transform the renderer uses, not handed over raw.
    spawnFlyer(
      state,
      state.pickType[i] as PickupTypeValue,
      (state.pickX[i] - state.camX) * state.zoom,
      (state.pickY[i] - state.camY) * state.zoom
    );
  }
}

/**
 * Deals contact damage to a frog standing on a Hazard platform (spikes).
 * Reuses the i-frame timer wholesale rather than adding a second one: landing
 * on spikes hits the instant `hurtTimer` is at 0, and standing there through a
 * full invuln window hits again the moment it clears — "leave in time or take
 * another hit" falls out of that for free.
 */
export function stepHazards(state: GameState) {
  'worklet';
  if (!state.grounded || state.groundedIndex < 0) return;
  if (PLATFORM_SPECS[state.platType[state.groundedIndex]].behaviour !== PlatformBehaviour.Hazard) return;
  if (state.hurtTimer > 0) return;
  damageFrog(state);
}

/** Ages every flying pickup-collection icon and frees it once its flight ends. */
export function stepFlyers(state: GameState, dt: number) {
  'worklet';
  for (let i = 0; i < MAX_FLYERS; i += 1) {
    if (state.flyAlive[i] === 0) continue;
    state.flyElapsed[i] += dt;
    if (state.flyElapsed[i] >= FLY_DURATION) state.flyAlive[i] = 0;
  }
}

/** Ages every enemy-death puff and frees it once the skull has faded out. */
export function stepDeathFx(state: GameState, dt: number) {
  'worklet';
  for (let i = 0; i < MAX_DEATH_FX; i += 1) {
    if (state.fxAlive[i] === 0) continue;
    state.fxElapsed[i] += dt;
    if (state.fxElapsed[i] >= DEATH_FX_DURATION) state.fxAlive[i] = 0;
  }
}

/** Ages every landing puff and frees it once it has settled. */
export function stepDust(state: GameState, dt: number) {
  'worklet';
  for (let i = 0; i < MAX_DUST; i += 1) {
    if (state.dustAlive[i] === 0) continue;
    state.dustElapsed[i] += dt;
    if (state.dustElapsed[i] >= DUST_DURATION) state.dustAlive[i] = 0;
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
