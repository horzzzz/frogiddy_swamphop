import type { SkCanvas, SkHostRect, SkImage, SkPaint } from '@shopify/react-native-skia';

import {
  DESIGN_WIDTH,
  ENEMY_DEATH_LINGER,
  FIXED_DT,
  FROG_HALF_H,
  FROG_HALF_W,
  FROG_SPRITE_H,
  FROG_SPRITE_W,
  GRAVITY,
  HIT_FLASH_ALPHA,
  HIT_FLASH_INTERVAL,
  AIR_DRAG_PER_SECOND,
  MAX_ENEMIES,
  MAX_FALL_SPEED,
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
  drawTongueAim(canvas, state, scratch);
  drawAim(canvas, state, scratch);

  canvas.restore();
}
