import {
  ATTACK_POSE_DURATION,
  DRAG_THRESHOLD,
  FROG_HALF_H,
  HOLD_TO_AIM_TONGUE,
  MAX_PICKUPS,
  MAX_PLATFORMS,
  PICKUP_RADIUS,
  TAP_MAX_MOVEMENT,
  TONGUE_ARRIVE,
  TONGUE_COOLDOWN_HIT,
  TONGUE_COOLDOWN_MISS,
  TONGUE_EXTEND_SPEED,
  TONGUE_MARCH_STEP,
  TONGUE_MOUTH_X,
  TONGUE_MOUTH_Y,
  TONGUE_PULL_SPEED,
  TONGUE_RANGE,
  TONGUE_RETRACT_SPEED,
} from '@/game/constants';
import { applyAim, land, launchFrog, surfaceYAt, wrapX, wrappedDeltaX } from '@/game/physics';
import { clearTongue } from '@/game/state';
import {
  PLATFORM_SPECS,
  TongueState,
  TongueTarget,
  TouchMode,
  type GameState,
} from '@/game/types';

/** Where the tongue leaves the frog. Mirrored with the sprite. */
function mouthX(state: GameState): number {
  'worklet';
  return wrapX(state.frogX + state.frogFacing * TONGUE_MOUTH_X);
}

function mouthY(state: GameState): number {
  'worklet';
  return state.frogY + TONGUE_MOUTH_Y;
}

/**
 * Marches a ray from the mouth toward the aim direction, up to `TONGUE_RANGE`,
 * and returns whatever it touches first. Records the result in the `tongueAim*`
 * fields so the fire, the preview and the highlight ring all agree.
 *
 * This replaces target scoring outright — no nearest-candidate guessing, no
 * forgiveness cone. The tongue grabs exactly what is in the way of the aimed
 * direction, nothing more. A platform counts as hit anywhere in its drawn body
 * (surface down to its sprite's bottom edge), not only along the top surface
 * line, so aiming at its face or underside grabs it just as aiming at the top
 * does. If this turns out too unforgiving to play, the fix is a wider forgiving
 * cone or a scored fallback — deliberately not built until it is known to be
 * needed.
 *
 * The march step is small enough that no platform can be skipped: at 4 design
 * units per sample, the ray cannot cross a full platform body (the thinnest is
 * 37 units tall, the narrowest under 90 wide) between two samples regardless of
 * the aim angle.
 */
export function pickTongueTarget(state: GameState, aimX: number, aimWorldY: number) {
  'worklet';
  const originX = mouthX(state);
  const originY = mouthY(state);

  const dx = wrappedDeltaX(originX, aimX);
  const dy = aimWorldY - originY;
  const length = Math.sqrt(dx * dx + dy * dy);
  // Degenerate aim (finger right on the mouth): point straight up rather than
  // leave the direction undefined.
  const dirX = length < 1 ? 0 : dx / length;
  const dirY = length < 1 ? -1 : dy / length;

  const steps = Math.ceil(TONGUE_RANGE / TONGUE_MARCH_STEP);
  for (let step = 1; step <= steps; step += 1) {
    const t = Math.min(step * TONGUE_MARCH_STEP, TONGUE_RANGE);
    const px = wrapX(originX + dirX * t);
    const py = originY + dirY * t;

    for (let i = 0; i < MAX_PLATFORMS; i += 1) {
      if (state.platAlive[i] === 0 || i === state.groundedIndex) continue;

      const spec = PLATFORM_SPECS[state.platType[i]];
      const left = state.platX[i] + spec.insetX;
      const right = state.platX[i] + spec.w - spec.insetX;
      const onPlatX = state.platX[i] + wrappedDeltaX(state.platX[i], px);
      if (onPlatX < left || onPlatX > right) continue;

      const topY = surfaceYAt(spec, state.platY[i], onPlatX, left, right);
      const bottomY = state.platY[i] + spec.h;
      if (py < topY || py > bottomY) continue;

      // Hit anywhere in the body, but always anchor on the top surface at that
      // X — the frog lands standing on the platform, not embedded in its side.
      state.tongueAimTarget = TongueTarget.Platform;
      state.tongueAimIndex = i;
      state.tongueAimX = wrapX(onPlatX);
      state.tongueAimY = topY;
      return;
    }

    for (let i = 0; i < MAX_PICKUPS; i += 1) {
      if (state.pickAlive[i] === 0) continue;

      const pdx = wrappedDeltaX(px, state.pickX[i]);
      const pdy = state.pickY[i] - py;
      if (pdx * pdx + pdy * pdy > PICKUP_RADIUS * PICKUP_RADIUS) continue;

      state.tongueAimTarget = TongueTarget.Pickup;
      state.tongueAimIndex = i;
      state.tongueAimX = state.pickX[i];
      state.tongueAimY = state.pickY[i];
      return;
    }
  }

  state.tongueAimTarget = TongueTarget.None;
  state.tongueAimIndex = -1;
  state.tongueAimX = wrapX(originX + dirX * TONGUE_RANGE);
  state.tongueAimY = originY + dirY * TONGUE_RANGE;
}

/**
 * Launches the tongue toward whatever an aim at this point would grab.
 *
 * Reuses `pickTongueTarget`'s result outright: a miss already comes back as the
 * point at full `TONGUE_RANGE` along the aim direction, which is exactly the
 * lash-out-and-return the tongue should do when nothing was in its path.
 */
export function fireTongue(state: GameState, aimX: number, aimWorldY: number) {
  'worklet';
  pickTongueTarget(state, aimX, aimWorldY);

  state.tongueTarget = state.tongueAimTarget;
  state.tongueTargetIndex = state.tongueAimIndex;
  state.tongueAnchorX = state.tongueAimX;
  state.tongueAnchorY = state.tongueAimY;
  if (state.tongueTarget === TongueTarget.Platform) {
    // Store the anchor relative to the platform so a moving one carries it.
    state.tongueAnchorOffsetX = wrappedDeltaX(
      state.platX[state.tongueTargetIndex],
      state.tongueAimX
    );
  }

  const facing = wrappedDeltaX(state.frogX, state.tongueAnchorX);
  if (facing > 2) state.frogFacing = 1;
  else if (facing < -2) state.frogFacing = -1;

  state.tongueTipX = mouthX(state);
  state.tongueTipY = mouthY(state);
  state.tongueState = TongueState.Extending;
}

/** Fires whatever the ground aim was pointing at when the finger came up. */
export function releaseTongueAim(state: GameState) {
  'worklet';
  if (state.tongueState !== TongueState.Aiming) return;
  fireTongue(state, wrapX(state.touchX), state.touchY + state.camY);
}

/** Placeholder for the ground tap until there is anything to hit. */
export function triggerAttack(state: GameState) {
  'worklet';
  if (!state.grounded) return;
  state.attackTimer = ATTACK_POSE_DURATION;
}

function abandonTongue(state: GameState) {
  'worklet';
  state.tongueTarget = TongueTarget.None;
  state.tongueTargetIndex = -1;
  state.tongueState = TongueState.Retracting;
  state.tongueCooldown = TONGUE_COOLDOWN_MISS;
}

/**
 * Resolves the live touch into a mode and acts on it.
 *
 * This runs in the simulation rather than in the gesture callbacks because
 * `onUpdate` only fires when the finger moves — and a hold is precisely the case
 * where it does not. Deciding here also means one code path instead of two.
 */
export function resolveTouch(state: GameState) {
  'worklet';
  if (!state.touchActive) return;

  // The mode is locked for the life of a touch, but losing the ground is an
  // outside event rather than gesture ambiguity: a bouncy platform can launch
  // the frog with the finger still down, and a jump aim left running in mid-air
  // would keep drawing a trajectory the player can no longer use.
  if (!state.grounded && (state.touchMode === TouchMode.JumpAim || state.touchMode === TouchMode.TongueAim)) {
    state.aiming = false;
    if (state.tongueState === TongueState.Aiming) clearTongue(state);
    state.touchMode = TouchMode.AirTongue;
  }

  if (state.touchMode === TouchMode.Undecided) {
    if (!state.grounded) {
      state.touchMode = TouchMode.AirTongue;
    } else if (state.touchMoved >= DRAG_THRESHOLD) {
      state.touchMode = TouchMode.JumpAim;
    } else if (state.elapsed - state.touchStartedAt >= HOLD_TO_AIM_TONGUE) {
      state.touchMode = TouchMode.TongueAim;
    }
  }

  if (state.touchMode === TouchMode.JumpAim) {
    applyAim(state, state.touchX - state.touchStartX, state.touchY - state.touchStartY);
    return;
  }

  if (state.touchMode === TouchMode.TongueAim) {
    state.aiming = false;
    if (state.tongueState === TongueState.Idle && state.tongueCooldown <= 0) {
      state.tongueState = TongueState.Aiming;
    }
    if (state.tongueState === TongueState.Aiming) {
      pickTongueTarget(state, wrapX(state.touchX), state.touchY + state.camY);
    }
    return;
  }

  if (state.touchMode === TouchMode.AirTongue) {
    // Keeping the finger down re-fires the moment the cooldown clears, aimed
    // wherever the finger is now. That is what makes "Hold/Tap to grab"
    // forgiving about timing.
    if (
      !state.grounded &&
      state.tongueState === TongueState.Idle &&
      state.tongueCooldown <= 0 &&
      !state.tongueUsedThisFlight
    ) {
      fireTongue(state, wrapX(state.touchX), state.touchY + state.camY);
    }
  }
}

/** Acts on the finger lifting. A discrete event, so the gesture handles it directly. */
export function endTouch(state: GameState) {
  'worklet';
  // Resolve once more first. A fast flick can cross the drag threshold and lift
  // between two simulation steps, and without this the mode would still read as
  // undecided while the movement already disqualified it from being a tap —
  // leaving the gesture with nothing to do.
  resolveTouch(state);

  if (state.touchMode === TouchMode.JumpAim) {
    // `aiming`, not `aimPower`: a drag exactly on the minimum has zero power but
    // is still a deliberate jump, and should produce the smallest hop rather
    // than silently nothing.
    if (state.grounded && state.aiming) launchFrog(state);
  } else if (state.touchMode === TouchMode.TongueAim) {
    releaseTongueAim(state);
  } else if (
    state.touchMode === TouchMode.Undecided &&
    state.grounded &&
    state.touchMoved < TAP_MAX_MOVEMENT
  ) {
    triggerAttack(state);
  }

  state.touchActive = false;
  state.touchMode = TouchMode.None;
  state.touchMoved = 0;
  state.aiming = false;
}

/** Advances the tongue state machine. Returns nothing; motion is written to the state. */
export function stepTongue(state: GameState, dt: number) {
  'worklet';
  if (state.tongueCooldown > 0) state.tongueCooldown = Math.max(0, state.tongueCooldown - dt);
  if (state.attackTimer > 0) state.attackTimer = Math.max(0, state.attackTimer - dt);

  const phase = state.tongueState;
  if (phase === TongueState.Idle || phase === TongueState.Aiming) return;

  // Follow the anchor if it moved, and give up on it if it stopped existing.
  if (state.tongueTarget === TongueTarget.Platform) {
    const index = state.tongueTargetIndex;
    if (index < 0 || state.platAlive[index] === 0) {
      abandonTongue(state);
      return;
    }
    state.tongueAnchorX = wrapX(state.platX[index] + state.tongueAnchorOffsetX);
  } else if (state.tongueTarget === TongueTarget.Pickup) {
    const index = state.tongueTargetIndex;
    if (index < 0 || state.pickAlive[index] === 0) {
      abandonTongue(state);
      return;
    }
    state.tongueAnchorX = state.pickX[index];
    state.tongueAnchorY = state.pickY[index];
  }

  if (phase === TongueState.Extending) {
    const dx = wrappedDeltaX(state.tongueTipX, state.tongueAnchorX);
    const dy = state.tongueAnchorY - state.tongueTipY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const step = TONGUE_EXTEND_SPEED * dt;

    if (distance <= Math.max(step, TONGUE_ARRIVE)) {
      state.tongueTipX = state.tongueAnchorX;
      state.tongueTipY = state.tongueAnchorY;
      if (state.tongueTarget === TongueTarget.None) {
        state.tongueState = TongueState.Retracting;
        state.tongueCooldown = TONGUE_COOLDOWN_MISS;
      } else {
        state.tongueState = TongueState.Pulling;
        state.tongueUsedThisFlight = true;
      }
      return;
    }

    state.tongueTipX = wrapX(state.tongueTipX + (dx / distance) * step);
    state.tongueTipY += (dy / distance) * step;
    return;
  }

  if (phase === TongueState.Retracting) {
    const dx = wrappedDeltaX(state.tongueTipX, mouthX(state));
    const dy = mouthY(state) - state.tongueTipY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const step = TONGUE_RETRACT_SPEED * dt;

    if (distance <= step) {
      clearTongue(state);
      return;
    }
    state.tongueTipX = wrapX(state.tongueTipX + (dx / distance) * step);
    state.tongueTipY += (dy / distance) * step;
    return;
  }

  // Pulling. The tongue drives the frog at a constant speed with gravity off:
  // constant speed rather than a force, because the player has to be able to read
  // where they will end up the instant the tongue connects.
  const onPlatform = state.tongueTarget === TongueTarget.Platform;
  const targetY = state.tongueAnchorY - (onPlatform ? FROG_HALF_H : 0);
  const dx = wrappedDeltaX(state.frogX, state.tongueAnchorX);
  const dy = targetY - state.frogY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const step = TONGUE_PULL_SPEED * dt;

  state.tongueTipX = state.tongueAnchorX;
  state.tongueTipY = state.tongueAnchorY;

  if (distance <= Math.max(step, TONGUE_ARRIVE)) {
    if (onPlatform) {
      // `land` also puts the tongue away and refreshes the per-flight grab.
      land(state, state.tongueTargetIndex, state.tongueAnchorY);
      state.tongueCooldown = TONGUE_COOLDOWN_HIT;
      return;
    }
    // A pickup is not somewhere you can stand, so keep the momentum and fly on.
    const safe = Math.max(distance, 0.001);
    state.frogX = wrapX(state.tongueAnchorX);
    state.frogY = targetY;
    state.frogVX = (dx / safe) * TONGUE_PULL_SPEED;
    state.frogVY = (dy / safe) * TONGUE_PULL_SPEED;
    clearTongue(state);
    state.tongueCooldown = TONGUE_COOLDOWN_HIT;
    return;
  }

  state.frogX = wrapX(state.frogX + (dx / distance) * step);
  state.frogY += (dy / distance) * step;
  state.frogVX = (dx / distance) * TONGUE_PULL_SPEED;
  state.frogVY = (dy / distance) * TONGUE_PULL_SPEED;
  if (state.frogY < state.peakY) state.peakY = state.frogY;
}
