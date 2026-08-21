export type WheelSegment = {
  kind: 'coins' | 'free-spins' | 'fail';
  amount: number;
  /** Relative pick chance — not a percentage, just weighed against the others. */
  weight: number;
};

/**
 * Order matches the wedges baked into assets/images/wheel/sectors.webp
 * (labels included in the art), starting at the top (12 o'clock) and going
 * clockwise. Reordering this array without re-exporting the art will desync
 * amounts from what the wheel visually lands on.
 */
export const WHEEL_SEGMENTS: WheelSegment[] = [
  { kind: 'coins', amount: 10000, weight: 1 },
  { kind: 'coins', amount: 100, weight: 16 },
  { kind: 'fail', amount: 0, weight: 12 },
  { kind: 'coins', amount: 500, weight: 10 },
  { kind: 'coins', amount: 1000, weight: 5 },
  { kind: 'coins', amount: 200, weight: 14 },
  { kind: 'free-spins', amount: 3, weight: 6 },
  { kind: 'coins', amount: 300, weight: 12 },
  { kind: 'fail', amount: 0, weight: 12 },
  { kind: 'coins', amount: 5000, weight: 2 },
  { kind: 'coins', amount: 150, weight: 14 },
  { kind: 'coins', amount: 800, weight: 8 },
];

export const WHEEL_SEGMENT_COUNT = WHEEL_SEGMENTS.length;

/** Weighted-random pick, returning an index into WHEEL_SEGMENTS. */
export function pickSegmentIndex(): number {
  const total = WHEEL_SEGMENTS.reduce((sum, segment) => sum + segment.weight, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < WHEEL_SEGMENTS.length; i++) {
    roll -= WHEEL_SEGMENTS[i].weight;
    if (roll <= 0) return i;
  }
  return WHEEL_SEGMENTS.length - 1;
}
