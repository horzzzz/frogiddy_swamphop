import { CAMERA_ANCHOR, CAMERA_SMOOTH } from '@/game/constants';
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
  if (target >= state.camY) return;

  state.camY += (target - state.camY) * (1 - Math.exp(-CAMERA_SMOOTH * dt));
}
