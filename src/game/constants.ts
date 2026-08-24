/**
 * Every tunable number in the game lives here.
 *
 * Gameplay math runs in *design units* — the 430×932 frame the Figma screens are
 * drawn at — so sizes lifted from the mockups can be typed in verbatim. The
 * renderer scales design units to real pixels exactly once, per frame.
 *
 * The Y axis points down, matching the canvas. Climbing therefore *decreases* Y.
 */

export const DESIGN_WIDTH = 430;
export const DESIGN_HEIGHT = 932;

/** How many design units make up one metre on the HUD. */
export const PIXELS_PER_METER = 100;

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------

/** Physics runs at a fixed rate so the feel never depends on the display's refresh rate. */
export const FIXED_DT = 1 / 120;
/** A frame longer than this (app backgrounded, GC pause) is treated as a hitch and clamped. */
export const MAX_FRAME_DT = 0.25;
/** Upper bound on substeps per frame — stops a long hitch from spiralling into more hitches. */
export const MAX_SUBSTEPS = 4;

// ---------------------------------------------------------------------------
// Frog
// ---------------------------------------------------------------------------

/**
 * Every frog pose is exported into one shared 300×260 px box, bottom-aligned to a
 * common ground line, so the character never changes scale or hop between states.
 * These are that box in design units.
 */
export const FROG_SPRITE_W = 80;
export const FROG_SPRITE_H = 70;
/**
 * Collision box, measured from the sprite's centre. The half-height puts the box's
 * lower edge exactly on the exported ground line, so the frog's feet — not the
 * bottom of its bounding box — are what touches a platform. The half-width is
 * deliberately tighter than the art so near-misses still land.
 */
export const FROG_HALF_W = 20;
export const FROG_HALF_H = 33;

export const GRAVITY = 2600;
export const MAX_FALL_SPEED = 2400;

/** Weakest and strongest slingshot launch, in design units per second. */
export const JUMP_IMPULSE_MIN = 650;
export const JUMP_IMPULSE_MAX = 1450;
/** Bouncy platforms relaunch you automatically at this multiple of a full-power jump. */
export const BOUNCY_MULTIPLIER = 1.35;
/** Horizontal speed bleeds off this fraction per second while airborne. */
export const AIR_DRAG_PER_SECOND = 0.35;

/**
 * Peak height of a full-power straight-up jump. Platform gaps are derived from
 * this rather than hardcoded, so retuning gravity or impulse cannot silently
 * generate an unreachable level.
 */
export const MAX_JUMP_HEIGHT = (JUMP_IMPULSE_MAX * JUMP_IMPULSE_MAX) / (2 * GRAVITY);

// ---------------------------------------------------------------------------
// Slingshot aiming
// ---------------------------------------------------------------------------

/** Finger travel that maps to full power; dragging further adds nothing. */
export const AIM_MAX_DRAG = 170;
/** Shorter drags read as a mis-tap and cancel the aim instead of firing a weak jump. */
export const AIM_MIN_DRAG = 14;
/** Hard limit on how far from straight-up you may aim, in radians (75°). */
export const AIM_MAX_ANGLE = 1.309;

/** Ballistic preview: this many dots, sampled this far apart in simulated seconds. */
export const TRAJECTORY_DOTS = 26;
export const TRAJECTORY_DOT_INTERVAL = 0.05;
export const TRAJECTORY_DOT_RADIUS = 3.5;

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

/** Where the frog sits vertically at rest, as a fraction of screen height. */
export const CAMERA_ANCHOR = 0.62;
/** Exponential follow rate. Higher is snappier; the camera never pans back down. */
export const CAMERA_SMOOTH = 9;

// ---------------------------------------------------------------------------
// Level generation
// ---------------------------------------------------------------------------

/** Keep platforms generated this far above the top of the screen. */
export const SPAWN_AHEAD = DESIGN_HEIGHT;
/** Platforms this far below the bottom of the screen return to the pool. */
export const DESPAWN_BELOW = 240;
/**
 * Vertical gap between platforms, as a fraction of MAX_JUMP_HEIGHT.
 *
 * MAX_JUMP_HEIGHT is the *straight up* apex, so a gap anywhere near it leaves the
 * player almost no freedom: the one-way collision means the apex has to clear the
 * platform, and every unit of horizontal travel is bought with vertical rise.
 * Sweeping angle × power against the narrowest (96 px) platform, the share of
 * aims that land the jump falls off sharply:
 *
 *   ratio 0.30 → ~8.5%   0.42 → 5.7%   0.55 → 3.5%   0.72 → 1.5%
 *
 * 0.30–0.55 keeps the hardest gap about two and a half times tighter than the
 * easiest, which is a difficulty spread rather than a wall.
 */
export const GAP_MIN_RATIO = 0.3;
export const GAP_MAX_RATIO = 0.55;
/** Chance a platform carries a pickup above it. */
export const PICKUP_CHANCE = 0.45;
/** Of those pickups, the share that are crystals rather than coins. */
export const CRYSTAL_SHARE = 0.18;

/** Moving platforms oscillate as sin(phase); this is how fast the phase advances. */
export const MOVING_PLATFORM_SPEED = 1.1;
/** Half-travel of a moving platform, as a fraction of its free space on the row. */
export const MOVING_PLATFORM_RANGE = 0.5;

export const MAX_PLATFORMS = 40;
export const MAX_PICKUPS = 48;
export const MAX_ENEMIES = 16;

/** Shared height for every pickup; widths follow each sprite's own aspect. */
export const PICKUP_HEIGHT = 40;
/** Generous pickup radius — collecting should never feel like threading a needle. */
export const PICKUP_RADIUS = 30;
/** Pickups bob vertically by this much to read as collectable rather than scenery. */
export const PICKUP_BOB = 5;
export const PICKUP_BOB_SPEED = 2.4;

// ---------------------------------------------------------------------------
// Enemies & health
// ---------------------------------------------------------------------------

export const MAX_LIVES = 3;
/** i-frames after taking a hit. Also drives the hit-flash while it counts down. */
export const FROG_HURT_INVULN = 1;

/** Chance a spawned row also carries an enemy. Rolled after the platform is placed. */
export const ENEMY_CHANCE = 0.22;
/** Relative frequency per EnemyType. Purely cosmetic — every type shares the same
 *  behaviour, so this is just how often each look shows up. */
export const ENEMY_TYPE_WEIGHTS = [40, 35, 25];
/** No enemy spawns below this much climb — the run's opening stretch stays a pure
 *  platforming warm-up before combat is introduced. */
export const ENEMY_FREE_HEIGHT = 500;

/**
 * How long an enemy telegraphs before its attack lands — the window the player
 * has to either kill it or get out of its reach. The number to tune first for feel.
 */
export const ENEMY_WINDUP = 0.6;
/** Cooldown after an attack (hit or miss) before the enemy can wind up again. */
export const ENEMY_ATTACK_COOLDOWN = 1.2;
/** How long a killed enemy's corpse lingers, fading out, before its slot frees. */
export const ENEMY_DEATH_LINGER = 0.35;
/** Radius an idle enemy watches for a grounded frog to aggro onto. */
export const ENEMY_AGGRO_RANGE_X = 90;
export const ENEMY_AGGRO_RANGE_Y = 60;
/**
 * Unarmed reach: how close an enemy has to be for a ground tap to hit it, with
 * no Arsenal weapon equipped. Deliberately *shorter* than ENEMY_AGGRO_RANGE_X
 * above (90) — the frog's bare fist can't out-reach an enemy's attack, so
 * fighting unarmed always means trading a hit. The Arsenal's whole reason to
 * exist is closing that gap; every purchasable weapon's rangeX in
 * constants/weapons.ts starts past 90.
 */
export const ATTACK_RANGE_X = 70;
export const ATTACK_RANGE_Y = 50;
/** Bounce off a stomp kill — a small hop, well under a minimum jump (650), just
 *  enough to read as "bounced off its head" rather than an ordinary landing. */
export const STOMP_BOUNCE = 420;

/** Chance a row with no regular pickup gets a life instead, gated separately by
 *  `MAX_LIVES` at spawn time so a topped-up run never wastes one. */
export const LIFE_CHANCE = 0.12;

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

/**
 * Squash & stretch driven by vertical speed. This is the whole reason the renderer
 * is imperative — `SkRSXform`, used by the declarative <Atlas>, cannot express a
 * non-uniform scale.
 */
export const SQUASH_REFERENCE_SPEED = 1400;
export const SQUASH_MAX_STRETCH = 0.22;
export const SQUASH_MAX_SQUASH = 0.16;

/** Half-period of the frog's i-frame flicker — the visible sign the hit can't
 *  repeat yet. Toggled off `hurtTimer`, so it always ends exactly when i-frames do. */
export const HIT_FLASH_INTERVAL = 0.08;
/** Alpha while the flicker is in its "off" phase. */
export const HIT_FLASH_ALPHA = 0.35;

/** Set true to draw the diagnostic readout over the game. */
export const DEBUG_OVERLAY = false;

// ---------------------------------------------------------------------------
// Tongue
// ---------------------------------------------------------------------------

/**
 * Reach of the tongue, deliberately shorter than the widest platform gap (222).
 *
 * Nothing in the game rewards speed yet, so a safe repeatable move would crowd
 * out jumping if it could always reach the next ledge. Keeping the reach under
 * the gap range means the tongue saves a jump that fell short — it does not
 * replace the jump.
 */
export const TONGUE_RANGE = 170;
/**
 * Sample spacing for the aim raycast, in design units.
 *
 * A ray aimed well into a platform's body cannot be skipped: the thinnest
 * platform is 37 units tall, comfortably more than a step can move along either
 * axis. The one shape this cannot rule out is a ray that grazes exactly past a
 * platform's corner — entering on X right as it is about to enter on Y — which
 * a discrete march can only ever narrow, not eliminate. This step keeps that
 * window under a couple of units, which reads as a hit in practice.
 */
export const TONGUE_MARCH_STEP = 2;
export const TONGUE_EXTEND_SPEED = 1500;
export const TONGUE_RETRACT_SPEED = 2000;
export const TONGUE_PULL_SPEED = 1150;
/** How close the tip has to get before it counts as having reached its anchor. */
export const TONGUE_ARRIVE = 10;
/** A hit costs more than a miss — being afraid to try is worse than spamming. */
export const TONGUE_COOLDOWN_HIT = 0.9;
export const TONGUE_COOLDOWN_MISS = 0.35;
/** Mouth offset from the frog's centre. X is mirrored by facing. */
export const TONGUE_MOUTH_X = 13;
export const TONGUE_MOUTH_Y = -3;
export const TONGUE_WIDTH = 7;
export const TONGUE_TIP_RADIUS = 6;
/** Radius of the ring drawn around the anchor a ground aim would grab. */
export const TONGUE_HIGHLIGHT_RADIUS = 20;

// ---------------------------------------------------------------------------
// Touch
// ---------------------------------------------------------------------------

/**
 * One finger carries three separate actions on the ground, told apart by how
 * long it stays down and how far it travels.
 *
 * The generous hold and the small travel threshold together mean an ordinary
 * jump drag — which moves well past 10 units inside a quarter second — is never
 * mistaken for a tongue aim.
 */
export const HOLD_TO_AIM_TONGUE = 0.26;
/**
 * Both thresholds are `AIM_MIN_DRAG` on purpose, and must stay tied to it.
 *
 * If the drag threshold were lower, a touch could commit to a jump aim while
 * still being too short for `applyAim` to accept — and it would be neither a
 * jump nor a tap, so the flick would do nothing at all. Deriving both from the
 * same number closes that gap by construction.
 */
export const DRAG_THRESHOLD = AIM_MIN_DRAG;
export const TAP_MAX_MOVEMENT = AIM_MIN_DRAG;
/** How long the attack pose stays up after a ground tap. Placeholder until enemies exist. */
export const ATTACK_POSE_DURATION = 0.25;
export const TONGUE_COLOR = '#E0524B';
export const TONGUE_TIP_COLOR = '#F59089';
export const TONGUE_AIM_COLOR = 'rgba(255, 255, 255, 0.8)';
export const TONGUE_AIM_WIDTH = 3;
