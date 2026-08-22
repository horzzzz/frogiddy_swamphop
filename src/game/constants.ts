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

/** Shared height for every pickup; widths follow each sprite's own aspect. */
export const PICKUP_HEIGHT = 40;
/** Generous pickup radius — collecting should never feel like threading a needle. */
export const PICKUP_RADIUS = 30;
/** Pickups bob vertically by this much to read as collectable rather than scenery. */
export const PICKUP_BOB = 5;
export const PICKUP_BOB_SPEED = 2.4;

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

/** Set true to draw the diagnostic readout over the game. */
export const DEBUG_OVERLAY = false;
