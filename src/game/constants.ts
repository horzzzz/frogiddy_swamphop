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

/**
 * Weakest and strongest slingshot launch at Frogenetics level 0, in design units
 * per second. The live values are `jumpImpulseMin`/`jumpImpulseMax` on the state:
 * the Legs upgrade scales both by `sqrt(1 + 0.2 * level)`, because apex height
 * goes as the square of the impulse while the upgrade is sold as "+20% distance".
 *
 * 940 puts a full-power straight-up apex at 170 units, a little over the widest
 * generated gap (150). Much higher and one jump clears two or three rows at once,
 * which is exactly what this retune replaced. The min keeps the weakest jump at
 * roughly two thirds of the tightest gap — a lazy flick still reads as a jump
 * without ever landing one for free.
 */
export const JUMP_IMPULSE_MIN_BASE = 590;
export const JUMP_IMPULSE_MAX_BASE = 940;
/** Bouncy platforms relaunch you automatically at this multiple of a full-power jump. */
export const BOUNCY_MULTIPLIER = 1.35;
/** Horizontal speed bleeds off this fraction per second while airborne. */
export const AIR_DRAG_PER_SECOND = 0.35;

/**
 * Peak height of a full-power straight-up jump at level 0. Platform gaps are
 * derived from this rather than hardcoded, so retuning gravity or the impulse
 * cannot silently generate an unreachable level.
 *
 * Deliberately the *base* jump, never the upgraded one. If generation followed
 * the Legs upgrade, buying a level would push the platforms apart by as much as
 * it added to the jump and the upgrade would cancel itself out; every level above
 * 0 is pure slack instead.
 */
export const BASE_JUMP_HEIGHT = (JUMP_IMPULSE_MAX_BASE * JUMP_IMPULSE_MAX_BASE) / (2 * GRAVITY);

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
 * Vertical gap between platforms, as a fraction of BASE_JUMP_HEIGHT — 100 to 150
 * design units at the level-0 jump.
 *
 * Both ends are pinned by something physical rather than by taste. The floor is
 * the artwork: a platform sprite hangs up to 98 units below its own surface, so
 * rows closer than ~100 units start drawing through each other. The ceiling is
 * the ascent: clearing a gap G with an apex H leaves only
 * `H * sin(2 * acos(sqrt(G / H)))` units of horizontal travel on the way up — 110
 * units at the widest gap here, 167 at the tightest. Past that the frog runs out
 * of sideways reach before it runs out of height.
 *
 * That horizontal budget is what `MAX_SPAWN_DX` spends, so the two constants have
 * to be retuned together.
 */
export const GAP_MIN_RATIO = 0.59;
export const GAP_MAX_RATIO = 0.88;
/**
 * How far a row's platform may sit sideways from the row below it, centre to
 * centre. Kept under the 110-unit horizontal reach computed above, with each
 * platform's own width as further slack — a wide ledge can be caught well short
 * of its centre.
 *
 * Without this, every row drew its X from the full 430-wide field, which could
 * put neighbouring rows 215 units apart. At the old 404-unit apex that was
 * harmless (the ascent covered ~400 units sideways); at 170 it strands the frog
 * on a platform with nothing in reach — not a death, just a run that cannot
 * continue.
 */
export const MAX_SPAWN_DX = 100;
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

/**
 * Health at Frogenetics level 0. The live cap is `maxLives` on the state; the
 * Body upgrade adds one per level.
 */
export const BASE_MAX_LIVES = 3;
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
/**
 * Knockback a melee kill (the sword swing, not a stomp) sends the corpse off
 * with — horizontal speed away from the swing and a small upward pop, over the
 * `ENEMY_DEATH_LINGER` window. A stomp kill gets none of this; the frog's own
 * bounce already reads as the impact there.
 */
export const ENEMY_KNOCKBACK_VX = 130;
export const ENEMY_KNOCKBACK_VY = -90;
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
 *  `state.maxLives` at spawn time so a topped-up run never wastes one. */
export const LIFE_CHANCE = 0.12;

// ---------------------------------------------------------------------------
// Currency & rewards
// ---------------------------------------------------------------------------

/** Coins credited per coin pickup collected. */
export const COIN_PICKUP_VALUE = 10;
/** Coins credited for killing an enemy, by any method. */
export const ENEMY_KILL_COINS = 20;

/**
 * The "fly to the HUD counter" pickup animation: a cosmetic clone of the
 * collected icon spins, pops and flies from where it was collected to roughly
 * where its counter pill sits, then fades out. Purely presentational — the
 * currency itself is credited immediately at collection time, not when this
 * finishes.
 */
export const MAX_FLYERS = 24;
/**
 * The icon spins on the spot before it sets off, so a collection reads as two
 * beats — "you got this" and then "here is where it goes" — instead of the
 * pickup immediately smearing toward the HUD where it is hard to identify.
 */
export const FLY_HOLD = 0.28;
/** Hold plus travel. The travel leg keeps its original 0.5s, so the flight feels unchanged. */
export const FLY_DURATION = FLY_HOLD + 0.5;
/** Full rotations completed while showing off on the spot. */
export const FLY_HOLD_SPIN_TURNS = 1.5;
/** Full rotations completed over the flight itself, continuing from the hold. */
export const FLY_SPIN_TURNS = 2;
/** How far the icon scales up while it spins, e.g. 0.35 = +35%. Shrinks back as it arrives. */
export const FLY_POP_SCALE = 0.35;
/** Fraction of the *travel* leg after which alpha starts fading to 0. */
export const FLY_FADE_START = 0.7;

/**
 * Approximate design-unit centre of each HUD counter pill, for the flyers
 * above to aim at. Derived from GameHud's own layout (pause icon 24..60, three
 * 105-wide pills with 10 gaps: crystal 70..175, life 185..290, coin 300..405)
 * plus a guess at the safe-area inset the canvas itself never accounts for
 * (it always starts at the physical top of the screen, HUD's SafeAreaView
 * doesn't). Doesn't need to be exact — see FLY_FADE_START above.
 */
export const HUD_TARGET_Y = 60;
export const HUD_CRYSTAL_TARGET_X = 122.5;
export const HUD_LIFE_TARGET_X = 237.5;
export const HUD_COIN_TARGET_X = 352.5;

// ---------------------------------------------------------------------------
// Enemy death effect
// ---------------------------------------------------------------------------

/**
 * The puff-of-smoke-and-a-skull that marks a kill. Cosmetic only, spawned from
 * `killEnemy` so every kill path gets it, and drawn entirely with Skia
 * primitives — no texture is loaded for it. Like the flyers above, every value
 * is derived from the effect's own elapsed time at draw time rather than
 * stored, so a live effect costs one float of state and nothing else.
 *
 * Ten slots against sixteen enemies: it would take ten kills inside
 * `DEATH_FX_DURATION` to exhaust the pool, and `spawnDeathFx` drops the spawn
 * rather than misbehaving if it ever happened.
 */
export const MAX_DEATH_FX = 10;
/**
 * Deliberately longer than `ENEMY_DEATH_LINGER` (0.35): the skull should still
 * be rising after the corpse it came from has finished dissolving, otherwise
 * the two read as one clipped event instead of a body and a departing spirit.
 */
export const DEATH_FX_DURATION = 0.75;

/** How far the skull climbs over its life, in design units. */
export const DEATH_FX_RISE = 46;
/** Peak horizontal sway either side of the climb — what makes it drift rather than launch. */
export const DEATH_FX_SWAY = 5;
/** Peak tilt in degrees, on the same sine as the sway so the two read as one motion. */
export const DEATH_FX_TILT = 9;
/** Fraction of the effect spent popping the skull up to full size. */
export const DEATH_FX_POP_TIME = 0.18;
/** How far past full size the pop overshoots before settling, e.g. 0.25 = +25%. */
export const DEATH_FX_POP_OVERSHOOT = 0.25;
/** Fraction of the effect after which the skull starts fading out. */
export const DEATH_FX_FADE_START = 0.55;
/** Height of the drawn skull in design units; the authored path is scaled to it. */
export const DEATH_FX_SKULL_SIZE = 26;

/** Number of smoke puffs thrown out around the skull. */
export const DEATH_FX_PUFFS = 5;
/** How far the puffs drift from the centre of the burst. */
export const DEATH_FX_PUFF_SPREAD = 26;
/** Puffs also drift upward, trailing the skull rather than hanging under it. */
export const DEATH_FX_PUFF_LIFT = 16;
export const DEATH_FX_PUFF_RADIUS_START = 5;
export const DEATH_FX_PUFF_RADIUS_END = 15;
/** Opacity of a puff at birth. They only ever fade from here. */
export const DEATH_FX_PUFF_ALPHA = 0.55;

/** Bone. Warm rather than pure white so it sits in the swamp palette. */
export const DEATH_FX_SKULL_COLOR = '#F2ECDC';
/** Eye sockets, nose and outline — the swamp's darkest green rather than black. */
export const DEATH_FX_SKULL_DARK_COLOR = '#2C3A2A';
/** Centre of a smoke puff. The gradient carries it out to fully transparent. */
export const DEATH_FX_SMOKE_COLOR = '#C9D6C0';

// ---------------------------------------------------------------------------
// Landing dust
// ---------------------------------------------------------------------------

/**
 * The puff kicked up when the frog lands. Spawned from `land`, so the collision
 * sweep and a tongue grapple onto a platform both get it, and drawn with the
 * same one-shader-many-puffs approach as the death effect above.
 *
 * Short and cheap on purpose: landing is the single most frequent event in the
 * game, so this has to read at a glance and then get out of the way.
 */
export const MAX_DUST = 8;
export const DUST_DURATION = 0.42;
/** Puffs per landing, thrown out in left/right pairs — so keep this even. */
export const DUST_PUFFS = 8;
/**
 * How far the outermost pair travels along the surface. Set well past the frog
 * sprite's half-width (40) on purpose: anything tighter spends the whole effect
 * hidden behind the frog that caused it.
 */
export const DUST_SPREAD = 62;
/** How high the outermost pair floats by the time it fades. */
export const DUST_LIFT = 22;
export const DUST_RADIUS_START = 8;
export const DUST_RADIUS_END = 22;
/** Opacity of a puff at birth. They only ever fade from here. */
export const DUST_ALPHA = 0.72;

/**
 * Impact speed below which a landing raises nothing at all — a grapple that
 * barely settles onto a ledge should not puff, and without a floor every
 * micro-landing would fire the sound too.
 *
 * This is the *only* thing impact speed decides. The puff itself is always the
 * same size: a landing either happened or it didn't, and scaling it by fall
 * height made the common case too faint to read.
 */
export const DUST_MIN_SPEED = 260;

/** Pale silt, lighter than the death smoke so the two never read as the same event. */
export const DUST_COLOR = '#D8D2BC';

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
 * Reach of the tongue at Frogenetics level 0, deliberately shorter than the widest
 * platform gap (150). The live value is `tongueRange` on the state, scaled +20% of
 * this per Tongue upgrade level.
 *
 * Nothing in the game rewards speed yet, so a safe repeatable move would crowd
 * out jumping if it could always reach the next ledge. Keeping the base reach
 * under the gap range means the tongue saves a jump that fell short — it does not
 * replace the jump. Upgrading past the widest gap is the point of buying it.
 */
export const TONGUE_RANGE_BASE = 130;
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

// ---------------------------------------------------------------------------
// Sound cues
// ---------------------------------------------------------------------------

/**
 * Bits the simulation raises when something worth hearing happens. The canvas
 * drains them once per frame and hands them to the audio service in a single
 * hop to JS.
 *
 * A bitmask rather than a queue on purpose: the JS side only needs to know
 * *whether* a cue fired this frame — two coins picked up in the same frame are
 * one sound either way — and raising a bit is a single OR with no allocation,
 * which is the only kind of work a fixed-step loop should be doing.
 */
export const SFX_DAMAGE = 1;
export const SFX_PICKUP = 2;
export const SFX_HIT = 4;
export const SFX_LAND = 8;
