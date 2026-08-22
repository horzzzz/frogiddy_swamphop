import type { GameState } from '@/game/types';

/**
 * A seeded linear congruential generator, so a run is reproducible from its seed.
 *
 * `Math.random()` works inside worklets, but it cannot be replayed — and a level
 * you cannot regenerate is a level you cannot debug. Constants are the Numerical
 * Recipes pair; the quality is far beyond what platform placement needs.
 */
export function nextRandom(state: GameState): number {
  'worklet';
  state.rngState = (Math.imul(state.rngState, 1664525) + 1013904223) >>> 0;
  return state.rngState / 4294967296;
}

/** Uniform float in [min, max). */
export function randomRange(state: GameState, min: number, max: number): number {
  'worklet';
  return min + nextRandom(state) * (max - min);
}

/** Uniform integer in [0, count). */
export function randomInt(state: GameState, count: number): number {
  'worklet';
  return Math.floor(nextRandom(state) * count);
}
