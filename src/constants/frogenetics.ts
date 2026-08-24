import { BASE_MAX_LIVES, JUMP_IMPULSE_MAX_BASE, JUMP_IMPULSE_MIN_BASE, PIXELS_PER_METER, TONGUE_RANGE_BASE } from '@/game/constants';

/**
 * The Frogenetics catalog — stat upgrades bought with coins, five levels each.
 * This is the single source of truth for the progression math: the catalog
 * screen, the card, and `game.tsx` (which seeds `GameState` for a run) all read
 * through the helpers below rather than repeating the numbers.
 */
export type FrogeneticsId = 'tongue' | 'body' | 'legs';

/** Level per upgrade, 0 (unbought) through FROGENETICS_MAX_LEVEL. */
export type FrogeneticsLevels = Record<FrogeneticsId, number>;

export const FROGENETICS_MAX_LEVEL = 5;
/** Coin price of the first level; each further level costs FROGENETICS_PRICE_STEP more. */
export const FROGENETICS_BASE_PRICE = 300;
export const FROGENETICS_PRICE_STEP = 150;

export const DEFAULT_FROGENETICS_LEVELS: FrogeneticsLevels = { tongue: 0, body: 0, legs: 0 };

/** Coin cost to go from `level` to `level + 1`. Undefined past the cap. */
export function upgradePrice(level: number): number {
  return FROGENETICS_BASE_PRICE + FROGENETICS_PRICE_STEP * level;
}

/**
 * "+20% of the base value per level" — 1.0 at level 0, exactly 2.0 at the max
 * level (5), which is what makes every upgrade's cap read as a clean ×2.
 */
export function upgradeScale(level: number): number {
  return 1 + 0.2 * level;
}

export function maxLivesFor(level: number): number {
  return BASE_MAX_LIVES + level;
}

export function tongueRangeFor(level: number): number {
  return TONGUE_RANGE_BASE * upgradeScale(level);
}

/**
 * Apex height goes as impulse², so scaling the *jump distance* by `upgradeScale`
 * means scaling the impulse by its square root.
 *
 * Level generation is deliberately pinned to BASE_JUMP_HEIGHT (see that constant
 * in game/constants.ts) and never to this upgraded value — Legs never makes the
 * level itself harder or spawns wider gaps to "catch up" to it. What it buys
 * instead is margin: scaling `min` by the same factor as `max` shrinks how much
 * aim power a jump needs to clear the widest generated gap (150 units) from
 * ~84% at level 0 down to ~10% at level 5. A maxed-out Legs makes a sloppy,
 * half-hearted flick land jumps a level-0 frog could only make by pulling to
 * nearly full power — fewer whiffed jumps, not farther reach for its own sake.
 */
export function jumpImpulsesFor(level: number): { min: number; max: number } {
  const factor = Math.sqrt(upgradeScale(level));
  return { min: JUMP_IMPULSE_MIN_BASE * factor, max: JUMP_IMPULSE_MAX_BASE * factor };
}

export type FrogeneticsUpgrade = {
  id: FrogeneticsId;
  name: string;
  description: string;
  icon: number;
  /** Display value at a given level, e.g. "1.3 m", "3", "100%". */
  formatValue: (level: number) => string;
};

export const FROGENETICS_UPGRADES: readonly FrogeneticsUpgrade[] = [
  {
    id: 'tongue',
    name: 'Tongue',
    description: 'Tongue Range',
    icon: require('@/assets/images/frogenetics/icon-tongue.webp'),
    formatValue: (level) => `${(tongueRangeFor(level) / PIXELS_PER_METER).toFixed(1)} m`,
  },
  {
    id: 'body',
    name: 'Body',
    description: 'Max Health',
    icon: require('@/assets/images/frogenetics/icon-body.webp'),
    formatValue: (level) => String(maxLivesFor(level)),
  },
  {
    id: 'legs',
    name: 'Legs',
    description: 'Jump Power',
    icon: require('@/assets/images/frogenetics/icon-legs.webp'),
    formatValue: (level) => `${Math.round(upgradeScale(level) * 100)}%`,
  },
];
