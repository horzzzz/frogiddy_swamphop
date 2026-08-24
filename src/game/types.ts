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
  /** Damages the frog on landing, and again roughly every second it stays put. */
  Hazard: 3,
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
  Spikes: 10,
} as const;
export type PlatformTypeValue = (typeof PlatformType)[keyof typeof PlatformType];

export const PickupType = {
  Coin: 0,
  Crystal: 1,
  Life: 2,
} as const;
export type PickupTypeValue = (typeof PickupType)[keyof typeof PickupType];

/** Index into ENEMY_SPECS and into the enemy texture array. Order must match both. */
export const EnemyType = {
  Swamp: 0,
  Slime: 1,
  Mosq: 2,
} as const;
export type EnemyTypeValue = (typeof EnemyType)[keyof typeof EnemyType];

export const EnemyState = {
  Idle: 0,
  /** Telegraphing the attack pose; damage lands when this expires. */
  WindUp: 1,
  Recover: 2,
  /** Dead-pose corpse, fading out before the slot frees. */
  Dying: 3,
} as const;
export type EnemyStateValue = (typeof EnemyState)[keyof typeof EnemyState];

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
  // Spikes — dims and surfaceY eyeballed off the art (hurty.png), same aspect
  // ratio as the exported image; surfaceY sits at the shorter spikes' tip
  // height. First thing to nudge if landings connect too early or late.
  flat(135, 91, 17, 10, PlatformBehaviour.Hazard),
];

export type PickupSpec = { w: number; h: number };

/** Pickups share a height and keep their own aspect. Indexed by PickupType. */
export const PICKUP_SPECS: readonly PickupSpec[] = [
  { w: 38, h: 40 }, // Coin
  { w: 26, h: 40 }, // Crystal
  { w: 45, h: 40 }, // Life
];

export type EnemySpec = {
  /** Sprite footprint in design units. Each type's three poses (idle/attack/dead)
   *  share one tight canvas and ground line, cropped from the Figma source sheet
   *  — the same treatment the frog sprite got, so switching pose never jumps size. */
  w: number;
  h: number;
  /**
   * Half-height of the collision box, measured from the sprite's centre — same
   * convention as FROG_HALF_H, which is what makes the stomp check (feet crossing
   * the enemy's head plane) and the aggro/attack range checks symmetrical.
   * Deliberately tighter than the art: legs, wings and antennae stick out well
   * past the creature's actual body.
   */
  halfH: number;
  /** Whether the sprite bobs like a pickup — the two flying types do, the slime does not. */
  bob: boolean;
};

/** Indexed by EnemyType. */
export const ENEMY_SPECS: readonly EnemySpec[] = [
  { w: 56, h: 42, halfH: 16, bob: true }, // Swamp fly
  { w: 48, h: 33, halfH: 14, bob: false }, // Slime
  { w: 56, h: 37, halfH: 15, bob: true }, // Mosq
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

  // Health.
  lives: number;
  /** Counts down i-frames after a hit; also drives the hit-flash render. */
  hurtTimer: number;

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

  /** Counts down the attack pose after a ground tap. */
  attackTimer: number;
  /**
   * Half-width/half-height of the ground attack's hit box. Screen setup, not
   * run state — set from the equipped Arsenal weapon and left alone by
   * `resetRun`, the same way `viewH` is.
   */
  attackRangeX: number;
  attackRangeY: number;

  /**
   * Frogenetics stats. Screen setup, not run state — set from the purchased
   * upgrade levels and left alone by `resetRun`, same convention as
   * `attackRangeX/Y` above. `maxLives` is read by `resetRun` itself, since a
   * fresh run always starts topped up.
   */
  maxLives: number;
  tongueRange: number;
  jumpImpulseMin: number;
  jumpImpulseMax: number;
  /** Centre X of the most recently spawned row's platform, so the next row's
   *  centre can be kept within jumping distance of it. Run state — reset
   *  alongside the starting platform. */
  lastSpawnX: number;
  /** 1 if the most recently spawned row was Spikes, so the next row's type roll
   *  can rule Spikes back out — two hazard rows never land back to back. */
  lastPlatformWasSpikes: number;

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

  // Enemy pool.
  enemyX: Float32Array;
  enemyY: Float32Array;
  enemyType: Int8Array;
  enemyAlive: Uint8Array;
  enemyState: Int8Array;
  /** Counts down whatever `enemyState` is currently doing. */
  enemyTimer: Float32Array;
  /** Platform the enemy stands on, or -1 for a free-floating one. */
  enemyPlat: Int32Array;
  /** Anchor X relative to its platform's own X — same trick as `tongueAnchorOffsetX`,
   *  so a moving platform carries its enemy along. */
  enemyOffsetX: Float32Array;
  /** 1 faces right, -1 faces left. */
  enemyFacing: Float32Array;
  /** Per-enemy bob phase offset, same purpose as `pickPhase`. */
  enemyPhase: Float32Array;
  /** Corpse velocity while `enemyState === Dying`. Zero for a stomp kill —
   *  only a melee kill sets these. Meaningless once the slot frees. */
  enemyDeathVX: Float32Array;
  enemyDeathVY: Float32Array;

  // "Fly to the HUD counter" pickup animation — purely cosmetic, spawned
  // alongside crediting a coin/crystal/life pickup or an enemy-kill coin
  // reward. Position/scale/rotation/alpha are derived from `flyElapsed` at
  // draw time rather than stored, the same way the jump trajectory preview is.
  flyAlive: Uint8Array;
  /** A PickupTypeValue — which icon to draw and which counter to aim at. */
  flyKind: Int8Array;
  flyStartX: Float32Array;
  flyStartY: Float32Array;
  flyTargetX: Float32Array;
  flyTargetY: Float32Array;
  flyElapsed: Float32Array;
};
