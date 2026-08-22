/**
 * Shapes shared by every worklet in the engine.
 *
 * Enums are plain numbers rather than string unions: they are compared thousands
 * of times per second inside worklets, and integer comparison keeps the hot loops
 * free of string work.
 */

export const FrogState = {
  Idle: 0,
  Jump: 1,
  Fall: 2,
  Dead: 3,
} as const;
export type FrogStateValue = (typeof FrogState)[keyof typeof FrogState];

export const TongueState = {
  Idle: 0,
  /** Ground only: the player is holding and pointing before firing. */
  Aiming: 1,
  Extending: 2,
  Pulling: 3,
  Retracting: 4,
} as const;
export type TongueStateValue = (typeof TongueState)[keyof typeof TongueState];

export const TongueTarget = {
  None: 0,
  Platform: 1,
  Pickup: 2,
} as const;
export type TongueTargetValue = (typeof TongueTarget)[keyof typeof TongueTarget];

/**
 * What the current touch has been resolved to. Resolution happens once per touch
 * and is never revisited — a gesture that changed meaning mid-drag would be
 * impossible to aim.
 */
export const TouchMode = {
  None: 0,
  /** Down, but not yet long enough or far enough to tell the three apart. */
  Undecided: 1,
  JumpAim: 2,
  TongueAim: 3,
  AirTongue: 4,
  Attack: 5,
} as const;
export type TouchModeValue = (typeof TouchMode)[keyof typeof TouchMode];

export const PlatformBehaviour = {
  Static: 0,
  Moving: 1,
  Bouncy: 2,
} as const;
export type PlatformBehaviourValue = (typeof PlatformBehaviour)[keyof typeof PlatformBehaviour];

/** Index into PLATFORM_SPECS and into the platform texture array. Order must match both. */
export const PlatformType = {
  Long: 0,
  Medium: 1,
  Small: 2,
  Wooden: 3,
  Moving: 4,
  Bouncy: 5,
  Start: 6,
  Wall: 7,
  Slope: 8,
  Corner: 9,
} as const;
export type PlatformTypeValue = (typeof PlatformType)[keyof typeof PlatformType];

export const PickupType = {
  Coin: 0,
  Crystal: 1,
  Life: 2,
} as const;
export type PickupTypeValue = (typeof PickupType)[keyof typeof PickupType];

export type PlatformSpec = {
  /**
   * Sprite footprint in design units. Widths come from the Figma components;
   * heights follow each sprite's own aspect, because the art is cropped tight to
   * its pixels and stretching it to the nominal Figma box would distort it.
   */
  w: number;
  h: number;
  /**
   * Distance from the sprite's top edge down to the surface the frog stands on,
   * at the platform's LEFT edge. The art has decorative caps, grass sprigs and
   * hanging roots, so the drawn box and the collidable surface differ.
   */
  surfaceY: number;
  /** Surface offset at the RIGHT edge. Equal to `surfaceY` for every flat platform. */
  surfaceRightY: number;
  /**
   * Fraction of the width over which the surface ramps from `surfaceY` to
   * `surfaceRightY`; it is flat past that. The slope tile tops out around 82% of
   * its width, and a straight interpolation to the far edge would sink the frog
   * into the stone there.
   */
  surfaceRamp: number;
  /** Horizontal inset per side, trimming overhanging art off the landing area. */
  insetX: number;
  behaviour: PlatformBehaviourValue;
};

const flat = (
  w: number,
  h: number,
  surfaceY: number,
  insetX: number,
  behaviour: PlatformBehaviourValue = PlatformBehaviour.Static
): PlatformSpec => ({ w, h, surfaceY, surfaceRightY: surfaceY, surfaceRamp: 1, insetX, behaviour });

/**
 * Collision geometry per platform type. The surface offsets are read off the
 * artwork and are the first thing to tweak if landings feel like they connect
 * too early or too late.
 */
export const PLATFORM_SPECS: readonly PlatformSpec[] = [
  flat(308, 39, 3, 5), // Long
  flat(172, 37, 3, 5), // Medium
  flat(96, 38, 3, 4), // Small
  flat(195, 47, 4, 9), // Wooden
  flat(217, 40, 4, 11, PlatformBehaviour.Moving), // Moving
  flat(104, 94, 12, 9, PlatformBehaviour.Bouncy), // Bouncy
  flat(117, 85, 11, 11), // Start
  flat(95, 98, 4, 4), // Wall
  // Slope climbs left to right, topping out at ~82% of its width.
  { w: 157, h: 83, surfaceY: 71, surfaceRightY: 2, surfaceRamp: 0.82, insetX: 4, behaviour: PlatformBehaviour.Static },
  flat(135, 92, 3, 4), // Corner — the top bar spans the full width
];

export type PickupSpec = { w: number; h: number };

/** Pickups share a height and keep their own aspect. Indexed by PickupType. */
export const PICKUP_SPECS: readonly PickupSpec[] = [
  { w: 38, h: 40 }, // Coin
  { w: 26, h: 40 }, // Crystal
  { w: 45, h: 40 }, // Life
];

/**
 * The entire simulation, allocated once and mutated in place on the UI thread.
 *
 * Entity pools are parallel typed arrays rather than arrays of objects: no
 * allocation happens during a run, which is what keeps frames free of GC pauses.
 * `platAlive` / `pickAlive` act as the free list — a zero slot is available.
 */
export type GameState = {
  // Frog. Its origin is the centre of the sprite, which makes mirroring and
  // squash & stretch a plain scale about the origin at draw time.
  frogX: number;
  frogY: number;
  frogVX: number;
  frogVY: number;
  frogState: FrogStateValue;
  /** 1 faces right, -1 faces left. */
  frogFacing: number;
  grounded: boolean;
  /** Platform the frog is standing on, or -1. Used to ride moving platforms. */
  groundedIndex: number;

  // Camera. `camY` is the world Y at the top edge of the screen.
  camY: number;
  /**
   * Visible height in design units. Scaling is driven by width so that the
   * horizontal wrap lines up with the mockups exactly; the vertical extent then
   * varies a few percent by device aspect, and culling, the death line and the
   * camera anchor all have to use this rather than the nominal 932.
   */
  viewH: number;

  // Run bookkeeping.
  running: boolean;
  /** World Y the run started at; height climbed is measured against it. */
  startY: number;
  /** Smallest (highest) frog Y reached this run. */
  peakY: number;
  coins: number;
  crystals: number;

  // Tongue.
  tongueState: TongueStateValue;
  /** Tip position in world space, wherever the tongue currently reaches to. */
  tongueTipX: number;
  tongueTipY: number;
  tongueAnchorX: number;
  tongueAnchorY: number;
  tongueTarget: TongueTargetValue;
  /** Pool index of whatever the anchor belongs to, or -1. */
  tongueTargetIndex: number;
  /** Anchor X relative to the platform's own X, so a moving platform carries it. */
  tongueAnchorOffsetX: number;
  tongueCooldown: number;
  /** One successful grab per flight; without this the grapple chains forever. */
  tongueUsedThisFlight: boolean;
  /** Anchor a ground aim would currently grab, for the highlight ring. */
  tongueAimTarget: TongueTargetValue;
  tongueAimIndex: number;
  tongueAimX: number;
  tongueAimY: number;

  // Raw touch facts. The gesture callbacks only record these; the simulation
  // decides what they mean, because a motionless finger produces no gesture
  // updates and a hold would otherwise never resolve.
  touchActive: boolean;
  touchMode: TouchModeValue;
  /** Screen-space design units. World Y is this plus `camY` at the moment of use. */
  touchStartX: number;
  touchStartY: number;
  touchX: number;
  touchY: number;
  /** Furthest the finger has strayed from where it landed. */
  touchMoved: number;
  /** Value of `elapsed` when the finger went down. */
  touchStartedAt: number;

  /** Counts down the attack pose after a ground tap. Placeholder until enemies exist. */
  attackTimer: number;

  // Slingshot aim.
  aiming: boolean;
  aimDX: number;
  aimDY: number;
  /** 0…1 power derived from drag length, cached so render and launch agree. */
  aimPower: number;

  // Generation cursor: world Y of the next platform to be placed.
  nextSpawnY: number;
  rngState: number;

  // Timing.
  accumulator: number;
  elapsed: number;

  // Platform pool.
  platX: Float32Array;
  platY: Float32Array;
  platType: Int8Array;
  platAlive: Uint8Array;
  /** Moving platforms only: oscillation origin, half-range and phase. */
  platBaseX: Float32Array;
  platRange: Float32Array;
  platPhase: Float32Array;

  // Pickup pool.
  pickX: Float32Array;
  pickY: Float32Array;
  pickType: Int8Array;
  pickAlive: Uint8Array;
  /** Per-pickup phase offset so a column of coins does not bob in lockstep. */
  pickPhase: Float32Array;
};
