import { CAMERA_ANCHOR, CAMERA_SMOOTH, DESIGN_WIDTH } from '@/game/constants';
import type { GameState } from '@/game/types';

/**
 * Follows the frog upward and never pans back down — falling has to feel like
 * losing ground, and a camera that chased the frog downward would rob the player
 * of the sight of the platform they missed.
 *
 * The follow is exponential and framerate-independent: the same `dt` worth of
 * catch-up happens whether the display runs at 60 or 120 Hz.
 */
export function updateCamera(state: GameState, dt: number) {
  'worklet';
  const target = state.frogY - state.viewH * CAMERA_ANCHOR;
  if (target < state.camY) {
    state.camY += (target - state.camY) * (1 - Math.exp(-CAMERA_SMOOTH * dt));
  }

  // Horizontal follow, centred rather than anchored — nothing about X reads
  // as "up" or "down", so unlike camY there is no one-way ratchet here. Clamped
  // into the world itself: at zoom 1 (Eyes maxed) `viewW` equals DESIGN_WIDTH
  // and the clamp range collapses to a single point, so camX sits at 0 and
  // this reduces to today's un-panned camera without a separate branch for it.
  const targetX = Math.min(
    Math.max(0, DESIGN_WIDTH - state.viewW),
    Math.max(0, state.frogX - state.viewW / 2)
  );
  state.camX += (targetX - state.camX) * (1 - Math.exp(-CAMERA_SMOOTH * dt));
}
