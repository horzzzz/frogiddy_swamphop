import {
  ATTACK_POSE_DURATION,
  DESIGN_WIDTH,
  ENEMY_KNOCKBACK_VX,
  ENEMY_KNOCKBACK_VY,
  FROG_HALF_H,
  FROG_HALF_W,
  MAX_ENEMIES,
  MAX_PLATFORMS,
  TAP_MAX_DURATION,
  TAP_MAX_MOVEMENT,
  TONGUE_ARRIVE,
  TONGUE_COOLDOWN_HIT,
  TONGUE_COOLDOWN_MISS,
  TONGUE_EXTEND_SPEED,
  TONGUE_MARCH_STEP,
  TONGUE_MOUTH_X,
  TONGUE_MOUTH_Y,
  TONGUE_PULL_SPEED,
  TONGUE_RETRACT_SPEED,
} from '@/game/constants';
import { clingToWall, land, surfaceYAt } from '@/game/physics';
import { clearTongue, killEnemy } from '@/game/state';
import {
  EnemyState,
  FrogState,
  PLATFORM_SPECS,
  TongueState,
  TongueTarget,
  TouchMode,
  type GameState,
} from '@/game/types';

/** Where the tongue leaves the frog. Mirrored with the sprite. */
function mouthX(state: GameState): number {
  'worklet';
  return state.frogX + state.frogFacing * TONGUE_MOUTH_X;
}

function mouthY(state: GameState): number {
  'worklet';
  return state.frogY + TONGUE_MOUTH_Y;
}

/**
 * Marches a ray from the mouth toward the aim direction, up to `state.tongueRange`,
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
 * Platforms and walls only — pickups are collected by flying or walking
 * through them (`collectPickups` in physics.ts), never by grappling onto
 * them, so this never scores against the pickup pool.
 *
 * The march step is small enough that no platform can be skipped: at 4 design
 * units per sample, the ray cannot cross a full platform body (the thinnest is
 * 37 units tall, the narrowest under 90 wide) between two samples regardless of
 * the aim angle.
 *
 * A world edge counts as a target too, checked last at each sample — a wall
 * has no body to enter, just a plane at `FROG_HALF_W` from either edge (the
 * same X `clingToWall` seats the frog at), so "crossed it" is the whole test.
 * The wall the frog is already clinging to is excluded, the same way its own
 * `groundedIndex` platform is below — aiming back at the wall under your own
 * feet would just re-select it.
 */
export function pickTongueTarget(state: GameState, aimX: number, aimWorldY: number) {
  'worklet';
  const originX = mouthX(state);
  const originY = mouthY(state);

  const dx = aimX - originX;
  const dy = aimWorldY - originY;
  const length = Math.sqrt(dx * dx + dy * dy);
  // Degenerate aim (finger right on the mouth): point straight up rather than
  // leave the direction undefined.
  const dirX = length < 1 ? 0 : dx / length;
  const dirY = length < 1 ? -1 : dy / length;

  const steps = Math.ceil(state.tongueRange / TONGUE_MARCH_STEP);
  for (let step = 1; step <= steps; step += 1) {
    const t = Math.min(step * TONGUE_MARCH_STEP, state.tongueRange);
    const px = originX + dirX * t;
    const py = originY + dirY * t;

    for (let i = 0; i < MAX_PLATFORMS; i += 1) {
      if (state.platAlive[i] === 0 || i === state.groundedIndex) continue;

      const spec = PLATFORM_SPECS[state.platType[i]];
      const left = state.platX[i] + spec.insetX;
      const right = state.platX[i] + spec.w - spec.insetX;
      if (px < left || px > right) continue;

      const topY = surfaceYAt(spec, state.platY[i], px, left, right);
      const bottomY = state.platY[i] + spec.h;
      if (py < topY || py > bottomY) continue;

      // Hit anywhere in the body, but always anchor on the top surface at that
      // X — the frog lands standing on the platform, not embedded in its side.
      state.tongueAimTarget = TongueTarget.Platform;
      state.tongueAimIndex = i;
      state.tongueAimX = px;
      state.tongueAimY = topY;
      return;
    }

    const clinging = state.frogState === FrogState.WallCling;
    if (px <= FROG_HALF_W && !(clinging && state.wallSide === -1)) {
      state.tongueAimTarget = TongueTarget.Wall;
      state.tongueAimIndex = -1;
      state.tongueAimX = FROG_HALF_W;
      state.tongueAimY = py;
      return;
    }
    if (px >= DESIGN_WIDTH - FROG_HALF_W && !(clinging && state.wallSide === 1)) {
      state.tongueAimTarget = TongueTarget.Wall;
      state.tongueAimIndex = -1;
      state.tongueAimX = DESIGN_WIDTH - FROG_HALF_W;
      state.tongueAimY = py;
      return;
    }
  }

  state.tongueAimTarget = TongueTarget.None;
  state.tongueAimIndex = -1;
  state.tongueAimX = originX + dirX * state.tongueRange;
  state.tongueAimY = originY + dirY * state.tongueRange;
}

/**
 * Launches the tongue toward whatever an aim at this point would grab.
 *
 * Reuses `pickTongueTarget`'s result outright: a miss already comes back as the
 * point at full `state.tongueRange` along the aim direction, which is exactly the
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
    state.tongueAnchorOffsetX = state.tongueAimX - state.platX[state.tongueTargetIndex];
  }

  const facing = state.tongueAnchorX - state.frogX;
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
  fireTongue(state, state.touchX + state.camX, state.touchY + state.camY);
}

/**
 * Swings the sword, grounded or airborne alike — the frog is rarely grounded
 * for more than one physics step now, so gating this on `grounded` would make
 * the weapon nearly unusable. The frog cannot turn on the spot for anything
 * but aiming the tongue, so the swing itself supplies the turn — it faces the
 * nearest threat in range, then the blade reaches everything else on that
 * same side. An enemy behind the turn survives this swing and needs another
 * tap.
 */
export function triggerAttack(state: GameState) {
  'worklet';
  state.attackTimer = ATTACK_POSE_DURATION;

  let nearestIndex = -1;
  let nearestDistSq = Infinity;
  let nearestDX = 0;

  for (let i = 0; i < MAX_ENEMIES; i += 1) {
    if (state.enemyAlive[i] === 0 || state.enemyState[i] === EnemyState.Dying) continue;

    const dx = state.enemyX[i] - state.frogX;
    const dy = state.enemyY[i] - state.frogY;
    if (Math.abs(dx) > state.attackRangeX || Math.abs(dy) > state.attackRangeY) continue;

    const distSq = dx * dx + dy * dy;
    if (distSq < nearestDistSq) {
      nearestDistSq = distSq;
      nearestIndex = i;
      nearestDX = dx;
    }
  }

  if (nearestIndex === -1) return;
  state.frogFacing = nearestDX >= 0 ? 1 : -1;

  for (let i = 0; i < MAX_ENEMIES; i += 1) {
    if (state.enemyAlive[i] === 0 || state.enemyState[i] === EnemyState.Dying) continue;

    const dx = state.enemyX[i] - state.frogX;
    const dy = state.enemyY[i] - state.frogY;
    if (Math.abs(dx) > state.attackRangeX || Math.abs(dy) > state.attackRangeY) continue;
    // Enemies dead centre (dx === 0) count as on whichever side the swing faces.
    if (dx !== 0 && Math.sign(dx) !== state.frogFacing) continue;

    killEnemy(state, i, state.frogFacing * ENEMY_KNOCKBACK_VX, ENEMY_KNOCKBACK_VY);
  }
}

function abandonTongue(state: GameState) {
  'worklet';
  state.tongueTarget = TongueTarget.None;
  state.tongueTargetIndex = -1;
  state.tongueState = TongueState.Retracting;
  state.tongueCooldown = TONGUE_COOLDOWN_MISS;
}

/**
 * Resolves the live touch into tongue-aim motion. Grounded or airborne makes
 * no difference any more — the finger has one job — so this starts an aim the
 * instant a touch lands (subject to the usual idle/cooldown/one-per-flight
 * gates) and keeps steering it every step the touch stays down. Whether the
 * touch turns out to have been a tap instead is decided later, on release, by
 * `endTouch`.
 *
 * This runs in the simulation rather than in the gesture callbacks because
 * `onUpdate` only fires when the finger moves — and a hold is precisely the case
 * where it does not. Deciding here also means one code path instead of two.
 */
export function resolveTouch(state: GameState) {
  'worklet';
  if (!state.touchActive || state.touchMode !== TouchMode.Aim) return;

  if (
    state.tongueState === TongueState.Idle &&
    state.tongueCooldown <= 0 &&
    !state.tongueUsedThisFlight
  ) {
    state.tongueState = TongueState.Aiming;
  }
  if (state.tongueState === TongueState.Aiming) {
    pickTongueTarget(state, state.touchX + state.camX, state.touchY + state.camY);
  }
}

/** Acts on the finger lifting. A discrete event, so the gesture handles it directly. */
export function endTouch(state: GameState) {
  'worklet';
  // Resolve once more first, so a release that lands between two simulation
  // steps still gets this step's aim before the tap/aim decision below.
  resolveTouch(state);

  // A tap — short and nearly motionless — is the attack; anything longer or
  // that moved further was always an aim. Both thresholds have to hold: a
  // slow, still touch is a deliberate long hold, and a fast flick that
  // travelled is a deliberate swipe, neither of which should swing the sword.
  const isTap =
    state.elapsed - state.touchStartedAt < TAP_MAX_DURATION && state.touchMoved < TAP_MAX_MOVEMENT;

  if (isTap) {
    // The aim may already have started drawing during the short tap window —
    // put it away rather than firing, so a tap never doubles as a shot.
    if (state.tongueState === TongueState.Aiming) clearTongue(state);
    triggerAttack(state);
  } else if (state.tongueState === TongueState.Aiming) {
    releaseTongueAim(state);
  }

  state.touchActive = false;
  state.touchMode = TouchMode.None;
  state.touchMoved = 0;
}

/** Advances the tongue state machine. Returns nothing; motion is written to the state. */
export function stepTongue(state: GameState, dt: number) {
  'worklet';
  if (state.tongueCooldown > 0) state.tongueCooldown = Math.max(0, state.tongueCooldown - dt);
  if (state.attackTimer > 0) state.attackTimer = Math.max(0, state.attackTimer - dt);

  const phase = state.tongueState;
  if (phase === TongueState.Idle || phase === TongueState.Aiming) return;

  // Follow the anchor if it moved, and give up on it if it stopped existing.
  // A wall anchor needs neither — walls don't move or disappear — so it falls
  // straight through to the phases below with whatever `fireTongue` set.
  if (state.tongueTarget === TongueTarget.Platform) {
    const index = state.tongueTargetIndex;
    if (index < 0 || state.platAlive[index] === 0) {
      abandonTongue(state);
      return;
    }
    state.tongueAnchorX = state.platX[index] + state.tongueAnchorOffsetX;
  }

  if (phase === TongueState.Extending) {
    const dx = state.tongueAnchorX - state.tongueTipX;
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

    state.tongueTipX += (dx / distance) * step;
    state.tongueTipY += (dy / distance) * step;
    return;
  }

  if (phase === TongueState.Retracting) {
    const dx = mouthX(state) - state.tongueTipX;
    const dy = mouthY(state) - state.tongueTipY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const step = TONGUE_RETRACT_SPEED * dt;

    if (distance <= step) {
      clearTongue(state);
      return;
    }
    state.tongueTipX += (dx / distance) * step;
    state.tongueTipY += (dy / distance) * step;
    return;
  }

  // Pulling. The tongue drives the frog at a constant speed with gravity off:
  // constant speed rather than a force, because the player has to be able to read
  // where they will end up the instant the tongue connects.
  const onPlatform = state.tongueTarget === TongueTarget.Platform;
  const targetY = state.tongueAnchorY - (onPlatform ? FROG_HALF_H : 0);
  const dx = state.tongueAnchorX - state.frogX;
  const dy = targetY - state.frogY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const step = TONGUE_PULL_SPEED * dt;

  state.tongueTipX = state.tongueAnchorX;
  state.tongueTipY = state.tongueAnchorY;

  if (distance <= Math.max(step, TONGUE_ARRIVE)) {
    if (onPlatform) {
      // `land` also puts the tongue away and refreshes the per-flight grab.
      land(state, state.tongueTargetIndex, state.tongueAnchorY);
    } else {
      // Only Platform and Wall ever reach Pulling — `tongueAnchorX` is
      // exactly FROG_HALF_W or DESIGN_WIDTH − FROG_HALF_W here, the same two
      // X values `clingToWall` itself seats the frog at, so which side it is
      // falls straight out of which half it's in.
      clingToWall(state, state.tongueAnchorX < DESIGN_WIDTH / 2 ? -1 : 1);
    }
    state.tongueCooldown = TONGUE_COOLDOWN_HIT;
    return;
  }

  state.frogX += (dx / distance) * step;
  state.frogY += (dy / distance) * step;
  state.frogVX = (dx / distance) * TONGUE_PULL_SPEED;
  state.frogVY = (dy / distance) * TONGUE_PULL_SPEED;
  if (state.frogY < state.peakY) state.peakY = state.frogY;
}
