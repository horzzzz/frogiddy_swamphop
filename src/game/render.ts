import type { SkCanvas, SkHostRect, SkImage, SkPaint, SkPath } from '@shopify/react-native-skia';

import {
  DEATH_FX_DURATION,
  DEATH_FX_FADE_START,
  DEATH_FX_POP_OVERSHOOT,
  DEATH_FX_POP_TIME,
  DEATH_FX_PUFFS,
  DEATH_FX_PUFF_ALPHA,
  DEATH_FX_PUFF_LIFT,
  DEATH_FX_PUFF_RADIUS_END,
  DEATH_FX_PUFF_RADIUS_START,
  DEATH_FX_PUFF_SPREAD,
  DEATH_FX_RISE,
  DEATH_FX_SKULL_SIZE,
  DEATH_FX_SWAY,
  DEATH_FX_TILT,
  DESIGN_WIDTH,
  DUST_ALPHA,
  DUST_DURATION,
  DUST_LIFT,
  DUST_PUFFS,
  DUST_RADIUS_END,
  DUST_RADIUS_START,
  DUST_SPREAD,
  ENEMY_DEATH_LINGER,
  FIXED_DT,
  FLY_HOLD,
  FLY_HOLD_SPIN_TURNS,
  FLY_DURATION,
  FLY_FADE_START,
  FLY_POP_SCALE,
  FLY_SPIN_TURNS,
  FROG_HALF_H,
  FROG_HALF_W,
  FROG_SPRITE_H,
  FROG_SPRITE_W,
  GRAVITY,
  HIT_FLASH_ALPHA,
  HIT_FLASH_INTERVAL,
  AIR_DRAG_PER_SECOND,
  MAX_DEATH_FX,
  MAX_DUST,
  MAX_ENEMIES,
  MAX_FALL_SPEED,
  MAX_FLYERS,
  MAX_PICKUPS,
  MAX_PLATFORMS,
  PICKUP_BOB,
  PICKUP_BOB_SPEED,
  PICKUP_HEIGHT,
  SQUASH_MAX_SQUASH,
  SQUASH_MAX_STRETCH,
  SQUASH_REFERENCE_SPEED,
  TONGUE_HIGHLIGHT_RADIUS,
  TONGUE_MOUTH_X,
  TONGUE_MOUTH_Y,
  TONGUE_TIP_RADIUS,
  TRAJECTORY_DOTS,
  TRAJECTORY_DOT_INTERVAL,
  TRAJECTORY_DOT_RADIUS,
} from '@/game/constants';
import { surfaceYAt, wrapX, wrappedDeltaX } from '@/game/physics';
import {
  ENEMY_SPECS,
  EnemyState,
  FrogState,
  PICKUP_SPECS,
  PLATFORM_SPECS,
  TongueState,
  TongueTarget,
  type GameState,
} from '@/game/types';

/** An image plus a preallocated rect covering all of it, so no `width()` call happens per frame. */
export type Sprite = {
  image: SkImage;
  src: SkHostRect;
};

export type GameAssets = {
  bg: Sprite;
  /** Indexed by FrogSprite. */
  frog: Sprite[];
  /** Indexed by PlatformType. */
  platforms: Sprite[];
  /** Indexed by PickupType. */
  pickups: Sprite[];
  /** Indexed by `enemyType * EnemyPose count + pose`. See EnemyPose. */
  enemies: Sprite[];
};

/** Indices into `GameAssets.frog`; must match the load order in use-game-assets. */
export const FrogSprite = {
  Idle: 0,
  Jump: 1,
  Fall: 2,
  WallLeft: 3,
  WallRight: 4,
  Tongue: 5,
  Attack: 6,
  Hit: 7,
  Dead: 8,
  BouncyHit: 9,
} as const;

/**
 * Pose offset within one enemy type's three-sprite run in `GameAssets.enemies`.
 * Order must match the load order in use-game-assets, which must match the crop
 * order the enemy sheet was built with.
 */
export const EnemyPose = {
  Idle: 0,
  Attack: 1,
  Dead: 2,
} as const;
const ENEMY_POSE_COUNT = 3;

/**
 * The death-effect skull, authored as SVG path data rather than shipped as an
 * image: it is two flat shapes, so a path costs no texture upload, stays crisp
 * at any device scale, and can be recoloured from constants to match the
 * palette. Built into an `SkPath` once at canvas setup — see game-canvas.
 *
 * Authored inside a `SKULL_PATH_W` x `SKULL_PATH_H` box with its origin at the
 * top-left; `drawDeathFx` centres it and scales the box to
 * `DEATH_FX_SKULL_SIZE`, so the art can be redrawn at any proportions without
 * touching the draw code.
 */
export const SKULL_PATH_W = 24;
export const SKULL_PATH_H = 27;
/** Cranium flaring into cheekbones, then a narrow jaw. */
export const SKULL_PATH_SVG =
  'M 12 0 C 5.373 0 0 5.373 0 12 L 0 14.5 C 0 16.9 1.7 18.9 4.1 19.4 ' +
  'L 7 20 L 7 23.5 C 7 25.4 8.6 27 10.5 27 L 13.5 27 C 15.4 27 17 25.4 17 23.5 ' +
  'L 17 20 L 19.9 19.4 C 22.3 18.9 24 16.9 24 14.5 L 24 12 C 24 5.373 18.627 0 12 0 Z';
/** Eye sockets, nose, and the two gaps that turn the jaw into teeth. */
export const SKULL_FEATURES_SVG =
  'M 3.9 12.5 a 3.6 4 0 1 0 7.2 0 a 3.6 4 0 1 0 -7.2 0 Z ' +
  'M 12.9 12.5 a 3.6 4 0 1 0 7.2 0 a 3.6 4 0 1 0 -7.2 0 Z ' +
  'M 12 15.4 L 13.7 18.6 L 10.3 18.6 Z ' +
  'M 10.2 20.2 h 1 v 6 h -1 Z M 12.8 20.2 h 1 v 6 h -1 Z';

/**
 * Mutable scratch shared by every draw call. Allocating a rect or a paint inside
 * the frame loop would hand the GC work sixty times a second; these are built
 * once and rewritten in place via `setXYWH`.
 */
export type RenderScratch = {
  paint: SkPaint;
  dotPaint: SkPaint;
  /** Stroked, round-capped: the tongue itself. */
  tonguePaint: SkPaint;
  /** Filled: the blob on the end of the tongue. */
  tongueTipPaint: SkPaint;
  /** Stroked: the ground aim ray and the ring around the anchor it would grab. */
  aimPaint: SkPaint;
  /** Filled, alpha rewritten per draw: enemies and the frog's i-frame flicker. */
  enemyPaint: SkPaint;
  /**
   * Carries a radial gradient authored at radius 1 around the origin, so one
   * shader draws every smoke puff at every size — `drawDeathFx` scales the
   * canvas instead of rebuilding it.
   */
  smokePaint: SkPaint;
  /** Filled bone. */
  skullPaint: SkPaint;
  /** Stroked dark: separates the skull from the smoke behind it. */
  skullOutlinePaint: SkPaint;
  /** Filled dark: eye sockets, nose and the gaps between the teeth. */
  skullDarkPaint: SkPaint;
  /** The landing puff. Same one-shader-many-puffs trick as `smokePaint`, paler. */
  dustPaint: SkPaint;
  skullPath: SkPath;
  skullFeaturesPath: SkPath;
  dst: SkHostRect;
  /** Only the background needs a variable source rect, for its cover crop. */
  src: SkHostRect;
};

function frogSpriteFor(state: GameState): number {
  'worklet';
  if (state.frogState === FrogState.Dead) return FrogSprite.Dead;
  // The hit pose covers the whole i-frame window, not just the instant of
  // impact — paired with the flicker below, that reads as "still recovering"
  // rather than a single flinch frame.
  if (state.hurtTimer > 0) return FrogSprite.Hit;
  if (state.attackTimer > 0) return FrogSprite.Attack;
  // Readying the tongue counts too — the pose is the feedback that a hold has
  // matured into an aim.
  if (state.tongueState !== TongueState.Idle) return FrogSprite.Tongue;
  if (state.frogState === FrogState.Jump) return FrogSprite.Jump;
  if (state.frogState === FrogState.Fall) return FrogSprite.Fall;
  return FrogSprite.Idle;
}

function drawBackground(canvas: SkCanvas, state: GameState, assets: GameAssets, s: RenderScratch) {
  'worklet';
  // The background does not scroll. It is a single painted scene with no seamless
  // vertical join, so tiling it can only ever show a hard edge — better a fixed
  // backdrop than a visible seam once per screen.
  //
  // It is cover-cropped rather than stretched: the source rect is narrowed or
  // shortened to match the device's aspect, so the art keeps its proportions on
  // any screen.
  const image = assets.bg.image;
  const imageW = assets.bg.src.width;
  const imageH = assets.bg.src.height;

  const scale = Math.max(DESIGN_WIDTH / imageW, state.viewH / imageH);
  const cropW = DESIGN_WIDTH / scale;
  const cropH = state.viewH / scale;

  s.src.setXYWH((imageW - cropW) / 2, (imageH - cropH) / 2, cropW, cropH);
  s.dst.setXYWH(0, 0, DESIGN_WIDTH, state.viewH);
  canvas.drawImageRect(image, s.src, s.dst, s.paint);
}

function drawPlatforms(canvas: SkCanvas, state: GameState, assets: GameAssets, s: RenderScratch) {
  'worklet';
  for (let i = 0; i < MAX_PLATFORMS; i += 1) {
    if (state.platAlive[i] === 0) continue;

    const spec = PLATFORM_SPECS[state.platType[i]];
    const screenY = state.platY[i] - state.camY;
    if (screenY > state.viewH || screenY + spec.h < 0) continue;

    const sprite = assets.platforms[state.platType[i]];
    s.dst.setXYWH(state.platX[i], screenY, spec.w, spec.h);
    canvas.drawImageRect(sprite.image, sprite.src, s.dst, s.paint);
  }
}

function drawPickups(
  canvas: SkCanvas,
  state: GameState,
  assets: GameAssets,
  s: RenderScratch,
  clock: number
) {
  'worklet';
  for (let i = 0; i < MAX_PICKUPS; i += 1) {
    if (state.pickAlive[i] === 0) continue;

    const screenY = state.pickY[i] - state.camY;
    if (screenY > state.viewH + PICKUP_HEIGHT || screenY < -PICKUP_HEIGHT) continue;

    const spec = PICKUP_SPECS[state.pickType[i]];
    const bob = Math.sin(clock * PICKUP_BOB_SPEED + state.pickPhase[i]) * PICKUP_BOB;
    const sprite = assets.pickups[state.pickType[i]];
    s.dst.setXYWH(state.pickX[i] - spec.w / 2, screenY - spec.h / 2 + bob, spec.w, spec.h);
    canvas.drawImageRect(sprite.image, sprite.src, s.dst, s.paint);
  }
}

/**
 * Draws every enemy, bottom-anchored to the surface it stands on rather than
 * centred on its collision box: the collision half-height is deliberately
 * tighter than the art (legs, wings, antennae reach past the body), so
 * centring on it would float the sprite above its feet.
 */
function drawEnemies(canvas: SkCanvas, state: GameState, assets: GameAssets, s: RenderScratch, clock: number) {
  'worklet';
  for (let i = 0; i < MAX_ENEMIES; i += 1) {
    if (state.enemyAlive[i] === 0) continue;

    const spec = ENEMY_SPECS[state.enemyType[i]];
    const surfaceScreenY = state.enemyY[i] + spec.halfH - state.camY;
    if (surfaceScreenY > state.viewH || surfaceScreenY - spec.h < -spec.h) continue;

    const dying = state.enemyState[i] === EnemyState.Dying;
    const pose =
      state.enemyState[i] === EnemyState.WindUp
        ? EnemyPose.Attack
        : dying
          ? EnemyPose.Dead
          : EnemyPose.Idle;
    const sprite = assets.enemies[state.enemyType[i] * ENEMY_POSE_COUNT + pose];

    const bob = spec.bob ? Math.sin(clock * PICKUP_BOB_SPEED + state.enemyPhase[i]) * PICKUP_BOB : 0;

    // Dying corpses fade out over their linger window rather than popping away.
    s.enemyPaint.setAlphaf(dying ? Math.max(0, state.enemyTimer[i] / ENEMY_DEATH_LINGER) : 1);

    canvas.save();
    canvas.translate(state.enemyX[i], surfaceScreenY + bob);
    canvas.scale(state.enemyFacing[i], 1);
    s.dst.setXYWH(-spec.w / 2, -spec.h, spec.w, spec.h);
    canvas.drawImageRect(sprite.image, sprite.src, s.dst, s.enemyPaint);
    canvas.restore();
  }
}

function drawFrogSprite(
  canvas: SkCanvas,
  state: GameState,
  assets: GameAssets,
  s: RenderScratch,
  x: number,
  screenY: number
) {
  'worklet';
  // Squash & stretch from vertical speed: stretched while climbing, compressed
  // while falling fast. Area is preserved so the frog never looks like it gained
  // or lost mass. This non-uniform scale is exactly what SkRSXform — and so the
  // declarative <Atlas> — cannot express, and why this renderer is imperative.
  const ratio = Math.max(-1, Math.min(1, state.frogVY / SQUASH_REFERENCE_SPEED));
  const scaleY = ratio < 0 ? 1 - ratio * SQUASH_MAX_STRETCH : 1 - ratio * SQUASH_MAX_SQUASH;
  const scaleX = 1 / scaleY;

  const sprite = assets.frog[frogSpriteFor(state)];

  // i-frame flicker: toggles off `hurtTimer` itself rather than the clock, so it
  // always lands on "visible" the instant invulnerability ends — no dangling
  // half-cycle. Reuses `enemyPaint`, the other alpha-mutable paint, rather than
  // touching `s.paint`, which draws the background/platforms/pickups too.
  let paint = s.paint;
  if (state.hurtTimer > 0) {
    const phase = Math.floor(state.hurtTimer / HIT_FLASH_INTERVAL) % 2;
    s.enemyPaint.setAlphaf(phase === 0 ? 1 : HIT_FLASH_ALPHA);
    paint = s.enemyPaint;
  }

  canvas.save();
  canvas.translate(x, screenY);
  canvas.scale(state.frogFacing * scaleX, scaleY);
  s.dst.setXYWH(-FROG_SPRITE_W / 2, -FROG_SPRITE_H / 2, FROG_SPRITE_W, FROG_SPRITE_H);
  canvas.drawImageRect(sprite.image, sprite.src, s.dst, paint);
  canvas.restore();
}

/**
 * The tongue is drawn per frog copy and outside the squash & stretch transform:
 * it hangs off the mouth, and stretching it with the body would read as rubber.
 */
function drawTongueFrom(
  canvas: SkCanvas,
  state: GameState,
  s: RenderScratch,
  frogDrawX: number,
  screenY: number
) {
  'worklet';
  if (state.tongueState === TongueState.Idle || state.tongueState === TongueState.Aiming) return;

  const mouthX = frogDrawX + state.frogFacing * TONGUE_MOUTH_X;
  const mouthY = screenY + TONGUE_MOUTH_Y;
  // Offsetting the tip from this copy's frog keeps it attached across the seam.
  const tipX = frogDrawX + wrappedDeltaX(state.frogX, state.tongueTipX);
  const tipY = state.tongueTipY - state.camY;

  canvas.drawLine(mouthX, mouthY, tipX, tipY, s.tonguePaint);
  canvas.drawCircle(tipX, tipY, TONGUE_TIP_RADIUS, s.tongueTipPaint);
}

function drawFrog(canvas: SkCanvas, state: GameState, assets: GameAssets, s: RenderScratch) {
  'worklet';
  const screenY = state.frogY - state.camY;
  const half = FROG_SPRITE_W / 2;

  drawFrogSprite(canvas, state, assets, s, state.frogX, screenY);
  drawTongueFrom(canvas, state, s, state.frogX, screenY);

  // Straddling the wrap seam: draw the other half so the frog is never sliced off.
  if (state.frogX < half) {
    drawFrogSprite(canvas, state, assets, s, state.frogX + DESIGN_WIDTH, screenY);
    drawTongueFrom(canvas, state, s, state.frogX + DESIGN_WIDTH, screenY);
  } else if (state.frogX > DESIGN_WIDTH - half) {
    drawFrogSprite(canvas, state, assets, s, state.frogX - DESIGN_WIDTH, screenY);
    drawTongueFrom(canvas, state, s, state.frogX - DESIGN_WIDTH, screenY);
  }
}

/**
 * The ground aim: a ray toward the finger plus a ring around the anchor that
 * would actually be grabbed.
 *
 * The ring is not decoration. Manual aiming is worse than automatic aiming
 * unless the player can see what the game has decided they are pointing at.
 */
function drawTongueAim(canvas: SkCanvas, state: GameState, s: RenderScratch) {
  'worklet';
  if (state.tongueState !== TongueState.Aiming) return;

  const mouthX = state.frogX + state.frogFacing * TONGUE_MOUTH_X;
  const mouthY = state.frogY + TONGUE_MOUTH_Y - state.camY;

  if (state.tongueAimTarget !== TongueTarget.None) {
    const targetX = state.frogX + wrappedDeltaX(state.frogX, state.tongueAimX);
    const targetY = state.tongueAimY - state.camY;
    canvas.drawLine(mouthX, mouthY, targetX, targetY, s.aimPaint);
    canvas.drawCircle(targetX, targetY, TONGUE_HIGHLIGHT_RADIUS, s.aimPaint);
    return;
  }

  // Nothing in reach. Draw the reach limit toward the finger, so pointing at
  // nothing looks like pointing at nothing rather than like a broken control.
  const dx = wrappedDeltaX(state.frogX, state.touchX);
  const dy = state.touchY + state.camY - state.frogY;
  const length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const reach = Math.min(length, state.tongueRange);
  canvas.drawLine(
    mouthX,
    mouthY,
    mouthX + (dx / length) * reach,
    mouthY + (dy / length) * reach,
    s.aimPaint
  );
}

function drawAim(canvas: SkCanvas, state: GameState, s: RenderScratch) {
  'worklet';
  if (!state.aiming || state.aimPower <= 0) return;

  // The preview runs the same integrator, at the same fixed step, as the real
  // simulation — so the dotted arc is not an approximation of the jump, it is
  // the jump. It also runs the same one-way platform collision `stepFrog` does,
  // so the dots stop exactly where the frog would actually land rather than
  // running on past it toward the bottom of the screen.
  const impulse = state.jumpImpulseMin + (state.jumpImpulseMax - state.jumpImpulseMin) * state.aimPower;
  let vx = state.aimDX * impulse;
  let vy = state.aimDY * impulse;
  let worldX = state.frogX;
  let worldY = state.frogY;

  const substeps = Math.max(1, Math.round(TRAJECTORY_DOT_INTERVAL / FIXED_DT));
  let landed = false;

  for (let dot = 0; dot < TRAJECTORY_DOTS && !landed; dot += 1) {
    for (let k = 0; k < substeps && !landed; k += 1) {
      const previousBottom = worldY + FROG_HALF_H;

      vy = Math.min(vy + GRAVITY * FIXED_DT, MAX_FALL_SPEED);
      vx -= vx * AIR_DRAG_PER_SECOND * FIXED_DT;
      worldX = wrapX(worldX + vx * FIXED_DT);
      worldY += vy * FIXED_DT;

      if (vy <= 0) continue;
      const bottom = worldY + FROG_HALF_H;

      for (let i = 0; i < MAX_PLATFORMS; i += 1) {
        if (state.platAlive[i] === 0 || i === state.groundedIndex) continue;

        const spec = PLATFORM_SPECS[state.platType[i]];
        const left = state.platX[i] + spec.insetX;
        const right = state.platX[i] + spec.w - spec.insetX;

        let overlapX = 0;
        let overlaps = false;
        for (let wrap = -1; wrap <= 1; wrap += 1) {
          const candidate = worldX + wrap * DESIGN_WIDTH;
          if (candidate + FROG_HALF_W > left && candidate - FROG_HALF_W < right) {
            overlapX = candidate;
            overlaps = true;
            break;
          }
        }
        if (!overlaps) continue;

        const surfaceY = surfaceYAt(spec, state.platY[i], overlapX, left, right);
        if (previousBottom > surfaceY || bottom < surfaceY) continue;

        worldY = surfaceY - FROG_HALF_H;
        landed = true;
        break;
      }
    }

    const screenY = worldY - state.camY;
    if (screenY > state.viewH) break;

    // Dots fade along the arc so the near end reads as "now" and the far end as
    // a guess the player should not over-trust.
    s.dotPaint.setAlphaf(0.85 * (1 - dot / TRAJECTORY_DOTS));
    canvas.drawCircle(worldX, screenY, TRAJECTORY_DOT_RADIUS, s.dotPaint);
  }
}

/**
 * Draws one complete frame. Called from a worklet; touches nothing outside its arguments.
 *
 * `clock` is the simulation time the caller read to trigger this redraw. Taking it
 * as a parameter rather than reading `state.elapsed` keeps the dependency that
 * drives the render loop visible at the call site, where it cannot be tidied away.
 */
/**
 * The "fly to the HUD counter" pickup animation. Position, scale, rotation and
 * alpha are all derived fresh from `flyElapsed` every frame — nothing about the
 * flight is stored — the same way `drawAim`'s trajectory preview works.
 *
 * Reuses `assets.pickups`/`PICKUP_SPECS`, the exact same sprites `drawPickups`
 * draws in the world, so a collected icon visually continues as the same icon
 * flying to its counter rather than switching art mid-flight.
 */
function drawFlyers(canvas: SkCanvas, state: GameState, assets: GameAssets, s: RenderScratch) {
  'worklet';
  for (let i = 0; i < MAX_FLYERS; i += 1) {
    if (state.flyAlive[i] === 0) continue;

    // Two beats. The icon first spins on the spot, then travels — splitting
    // them is what lets the player read *what* they picked up before it turns
    // into a streak heading for the HUD.
    const elapsed = state.flyElapsed[i];
    const holdP = Math.min(1, elapsed / FLY_HOLD);
    const travelP = Math.max(0, Math.min(1, (elapsed - FLY_HOLD) / (FLY_DURATION - FLY_HOLD)));

    // Ease-out: fast start, settling into the counter rather than snapping onto it.
    const eased = 1 - (1 - travelP) * (1 - travelP);
    const x = state.flyStartX[i] + (state.flyTargetX[i] - state.flyStartX[i]) * eased;
    const y = state.flyStartY[i] + (state.flyTargetY[i] - state.flyStartY[i]) * eased;

    // One continuous rotation across both beats, so the spin never stalls or
    // restarts at the hand-off from spinning to travelling.
    const spinDeg = (holdP * FLY_HOLD_SPIN_TURNS + travelP * FLY_SPIN_TURNS) * 360;
    // Scales up over the first third of the hold, stays big for the rest of the
    // spin, then shrinks back to normal on the way into the counter.
    const pop = 1 + FLY_POP_SCALE * Math.min(1, holdP * 3) * (1 - eased);
    // Keyed off the travel leg, not the whole life, so the icon holds full
    // opacity while it is spinning and only fades as it arrives.
    const alpha =
      travelP < FLY_FADE_START ? 1 : 1 - (travelP - FLY_FADE_START) / (1 - FLY_FADE_START);

    const spec = PICKUP_SPECS[state.flyKind[i]];
    const sprite = assets.pickups[state.flyKind[i]];

    s.enemyPaint.setAlphaf(alpha);
    canvas.save();
    canvas.translate(x, y);
    canvas.rotate(spinDeg, 0, 0);
    canvas.scale(pop, pop);
    s.dst.setXYWH(-spec.w / 2, -spec.h / 2, spec.w, spec.h);
    canvas.drawImageRect(sprite.image, sprite.src, s.dst, s.enemyPaint);
    canvas.restore();
  }
}

/**
 * The kill marker: a burst of smoke with a skull rising out of it.
 *
 * Drawn entirely from Skia primitives — the skull is the path authored above,
 * the smoke is one radial-gradient shader reused for every puff — so a kill
 * loads no texture and allocates nothing here. Position, size, alpha and tilt
 * are recomputed from `fxElapsed` every frame rather than stored, the same way
 * `drawFlyers` and `drawAim`'s preview work.
 *
 * Unlike the flyers, these hold *world* coordinates and subtract `camY` per
 * frame: a flyer is aiming at a fixed HUD pill and must ignore the camera,
 * while this effect belongs to the spot the enemy died on and has to scroll
 * with it. Also like `drawEnemies`, it does not draw a second copy across the
 * wrap seam — it should behave exactly like the enemy it came from.
 */
function drawDeathFx(canvas: SkCanvas, state: GameState, s: RenderScratch) {
  'worklet';
  for (let i = 0; i < MAX_DEATH_FX; i += 1) {
    if (state.fxAlive[i] === 0) continue;

    const screenY = state.fxY[i] - state.camY;
    // Culled on the area the whole effect can reach, not just its origin: the
    // skull climbs `DEATH_FX_RISE` above the spawn point and the puffs spread
    // out around it.
    if (screenY - DEATH_FX_RISE > state.viewH || screenY + DEATH_FX_PUFF_SPREAD < 0) continue;

    const t = Math.min(1, state.fxElapsed[i] / DEATH_FX_DURATION);
    // Ease-out: the burst throws everything out fast, then it drifts.
    const eased = 1 - (1 - t) * (1 - t);
    const x = state.fxX[i];
    const seed = state.fxSeed[i];

    for (let p = 0; p < DEATH_FX_PUFFS; p += 1) {
      const angle = seed + (p * Math.PI * 2) / DEATH_FX_PUFFS;
      // Alternating reach, so the ring reads as a cloud rather than a circle
      // of evenly spaced dots.
      const reach = 0.7 + 0.3 * (p % 2);
      const puffX = x + Math.cos(angle) * DEATH_FX_PUFF_SPREAD * reach * eased;
      // Flattened vertically and lifted as a whole: the cloud spreads wider
      // than it is tall and trails the skull upward instead of sitting under it.
      const puffY =
        screenY +
        Math.sin(angle) * DEATH_FX_PUFF_SPREAD * 0.45 * eased -
        DEATH_FX_PUFF_LIFT * eased;
      const radius =
        DEATH_FX_PUFF_RADIUS_START +
        (DEATH_FX_PUFF_RADIUS_END - DEATH_FX_PUFF_RADIUS_START) * eased;

      // Quadratic fade: thickest at the moment of the hit, thinning as it spreads.
      s.smokePaint.setAlphaf(DEATH_FX_PUFF_ALPHA * (1 - t) * (1 - t));

      canvas.save();
      canvas.translate(puffX, puffY);
      // The gradient is authored at radius 1, so scaling the canvas is what
      // gives the puff its size — and keeps its soft edge proportionally soft.
      canvas.scale(radius, radius);
      canvas.drawCircle(0, 0, 1, s.smokePaint);
      canvas.restore();
    }

    // Snaps up to full size over the pop window, bulging past it on the way:
    // 0 at u=0, 1 at u=1, and above 1 in between. That overshoot is what makes
    // the skull look like it was thrown out of the body rather than faded in.
    const u = Math.min(1, t / DEATH_FX_POP_TIME);
    const pop = 1 - (1 - u) * (1 - u) + DEATH_FX_POP_OVERSHOOT * Math.sin(u * Math.PI);

    // One sine drives both the drift and the tilt, so the skull reads as a
    // single object swaying rather than two effects layered on each other.
    const wobble = Math.sin(t * Math.PI * 2 + seed);
    const alpha =
      t < DEATH_FX_FADE_START ? 1 : 1 - (t - DEATH_FX_FADE_START) / (1 - DEATH_FX_FADE_START);
    const scale = (DEATH_FX_SKULL_SIZE / SKULL_PATH_H) * pop;

    s.skullPaint.setAlphaf(alpha);
    s.skullOutlinePaint.setAlphaf(alpha);
    s.skullDarkPaint.setAlphaf(alpha);

    canvas.save();
    canvas.translate(x + wobble * DEATH_FX_SWAY * eased, screenY - DEATH_FX_RISE * eased);
    canvas.rotate(wobble * DEATH_FX_TILT, 0, 0);
    canvas.scale(scale, scale);
    // The path is authored from its top-left corner; this centres it on the
    // transform above so it rotates and scales about its own middle.
    canvas.translate(-SKULL_PATH_W / 2, -SKULL_PATH_H / 2);
    canvas.drawPath(s.skullPath, s.skullPaint);
    canvas.drawPath(s.skullPath, s.skullOutlinePaint);
    canvas.drawPath(s.skullFeaturesPath, s.skullDarkPaint);
    canvas.restore();
  }
}

/**
 * The puff a landing kicks up, fanned out along the surface in left/right pairs.
 *
 * Pairs rather than a ring because this is a ground impact: the cloud should
 * spread sideways away from the feet and curl upward at its edges, not bloom
 * evenly the way the death burst does.
 *
 * Shares the death effect's approach exactly — world coordinates, everything
 * derived from `dustElapsed`, one gradient shader scaled per puff.
 */
function drawDust(canvas: SkCanvas, state: GameState, s: RenderScratch) {
  'worklet';
  for (let i = 0; i < MAX_DUST; i += 1) {
    if (state.dustAlive[i] === 0) continue;

    const screenY = state.dustY[i] - state.camY;
    if (screenY - DUST_LIFT > state.viewH || screenY + DUST_RADIUS_END < 0) continue;

    const t = Math.min(1, state.dustElapsed[i] / DUST_DURATION);
    // Ease-out: the impact throws the dust out, then it hangs and thins.
    const eased = 1 - (1 - t) * (1 - t);
    const x = state.dustX[i];
    const seed = state.dustSeed[i];

    for (let p = 0; p < DUST_PUFFS; p += 1) {
      const side = p % 2 === 0 ? -1 : 1;
      // Each pair reaches a different distance, so the cloud has some depth
      // instead of being one row of evenly spaced dots.
      const lane = (Math.floor(p / 2) + 1) / (DUST_PUFFS / 2);
      // Deterministic jitter: enough that consecutive landings don't stamp out
      // an identical shape, without storing anything per puff.
      const jitter = Math.sin(seed * 12.9898 + p * 4.1) * 0.22;

      const puffX = x + side * DUST_SPREAD * (lane + jitter) * eased;
      // The further a puff travels the higher it floats, so the cloud curls up
      // at its edges rather than sliding along a flat line.
      const puffY = screenY - DUST_LIFT * lane * eased;
      const radius = DUST_RADIUS_START + (DUST_RADIUS_END - DUST_RADIUS_START) * eased;

      s.dustPaint.setAlphaf(DUST_ALPHA * (1 - t) * (1 - t));

      canvas.save();
      canvas.translate(puffX, puffY);
      canvas.scale(radius, radius);
      canvas.drawCircle(0, 0, 1, s.dustPaint);
      canvas.restore();
    }
  }
}

export function drawScene(
  canvas: SkCanvas,
  state: GameState,
  assets: GameAssets,
  scratch: RenderScratch,
  screenScale: number,
  clock: number
) {
  'worklet';
  canvas.save();
  canvas.scale(screenScale, screenScale);

  drawBackground(canvas, state, assets, scratch);
  drawPlatforms(canvas, state, assets, scratch);
  drawPickups(canvas, state, assets, scratch, clock);
  drawEnemies(canvas, state, assets, scratch, clock);
  drawFrog(canvas, state, assets, scratch);
  // In front of the frog, not behind it: the puff is thrown out at the feet of
  // a sprite 80 units wide, and drawn underneath it the whole effect would
  // spend its short life hidden by whatever caused it.
  drawDust(canvas, state, scratch);
  // Above the world — a departing spirit should never be hidden behind the
  // corpse it left — but under the aim and the flyers, which are read as
  // controls and must stay legible through it.
  drawDeathFx(canvas, state, scratch);
  drawTongueAim(canvas, state, scratch);
  drawAim(canvas, state, scratch);
  drawFlyers(canvas, state, assets, scratch);

  canvas.restore();
}
