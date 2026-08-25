import { AUTO_JUMP_IMPULSE_BASE, BASE_MAX_LIVES, GRAVITY, PIXELS_PER_METER, TONGUE_RANGE_BASE } from '@/game/constants';

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
 * Apex height goes as impulse², so scaling the *jump height* by `upgradeScale`
 * means scaling the auto-jump impulse by its square root.
 *
 * Level generation is deliberately pinned to the base auto-jump (see GAP_MIN/
 * GAP_MAX in game/constants.ts) and never to this upgraded value — Legs never
 * makes the level itself harder or spawns wider gaps to "catch up" to it.
 * Every level bought is pure margin: a slightly taller auto-bounce that closes
 * a little more of the reach the tongue has to cover on its own.
 */
export function autoJumpImpulseFor(level: number): number {
  return AUTO_JUMP_IMPULSE_BASE * Math.sqrt(upgradeScale(level));
}

/** Peak height of an auto-jump at the given Legs level, for display. */
export function autoJumpHeightFor(level: number): number {
  const impulse = autoJumpImpulseFor(level);
  return (impulse * impulse) / (2 * GRAVITY);
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
    description: 'Auto-jump Height',
    icon: require('@/assets/images/frogenetics/icon-legs.webp'),
    formatValue: (level) => `${(autoJumpHeightFor(level) / PIXELS_PER_METER).toFixed(2)} m`,
  },
];
