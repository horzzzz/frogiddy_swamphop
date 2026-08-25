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

/**
 * Both this and `AUTO_JUMP_IMPULSE_BASE` below are tuned as a pair. Apex
 * height goes as `impulse² / gravity`, flight time as `impulse / gravity` —
 * so scaling gravity by `1/k²` and the impulse by `1/k` leaves every height
 * derived from the auto-jump (this constant, bouncy, stomp, every Legs level)
 * exactly where it was, while stretching flight time — and with it, how
 * "fast" the auto-jump reads — by exactly `k`. That is how these two numbers
 * were chosen: a 2600/620 pairing bounced in ~0.48s, which read as frantic;
 * this pairing (k = 2) keeps the same ~74-unit apex but takes ~0.95s.
 */
export const GRAVITY = 650;
export const MAX_FALL_SPEED = 2400;

/**
 * Vertical launch every landing fires automatically, Doodle-Jump style — the
 * frog is never grounded for more than one physics step (see `launchAutoJump`
 * in physics.ts). Design units per second at Frogenetics level 0; the live
 * value is `autoJumpImpulse` on the state, scaled by `sqrt(1 + 0.2 * level)`
 * per Legs level — apex height goes as the square of the impulse, while the
 * upgrade is sold as "+20% height".
 *
 * Deliberately small: this is no longer how the frog climbs, only how it
 * clears the platform underfoot. Getting anywhere still needs the tongue.
 */
export const AUTO_JUMP_IMPULSE_BASE = 310;
/**
 * Peak height of a level-0 auto-jump. Level generation is pinned to this
 * rather than hardcoded, so retuning gravity or the impulse cannot silently
 * generate an unreachable level. Deliberately the *base* jump, never the
 * Legs-upgraded one — see AUTO_JUMP_IMPULSE_BASE above for why a bought level
 * has to stay pure slack instead of the generator chasing it.
 */
export const AUTO_JUMP_HEIGHT = (AUTO_JUMP_IMPULSE_BASE * AUTO_JUMP_IMPULSE_BASE) / (2 * GRAVITY);
/** Bouncy platforms relaunch you automatically at this multiple of a base auto-jump. */
export const BOUNCY_MULTIPLIER = 1.65;
/** Straight horizontal speed the move joystick drives the frog at — no acceleration, no drift. */
export const MOVE_SPEED_MAX = 220;

// ---------------------------------------------------------------------------
// Tongue
// ---------------------------------------------------------------------------

/**
 * Reach of the tongue at Frogenetics level 0, in design units. The live value
 * is `tongueRange` on the state, scaled +20% of this per Tongue upgrade
 * level. Level generation is now built around this number — see GAP_MAX in
 * the Level generation section below — rather than the other way round, so a
 * bought Tongue level is pure margin on gaps the base reach already clears.
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
/**
 * A hit still costs more than a miss, but both are short — short enough to
 * clear well within a single bounce-to-bounce cycle (`2 *
 * AUTO_JUMP_IMPULSE_BASE / GRAVITY`, ~0.95s at level 0) rather than the old
 * slingshot-jump-era 0.9s hit cooldown, which was long enough to drop the
 * frog on the floor waiting for its own tongue to be usable again.
 */
export const TONGUE_COOLDOWN_HIT = 0.1;
export const TONGUE_COOLDOWN_MISS = 0.18;
/** Mouth offset from the frog's centre. X is mirrored by facing. */
export const TONGUE_MOUTH_X = 13;
export const TONGUE_MOUTH_Y = -3;
export const TONGUE_WIDTH = 7;
export const TONGUE_TIP_RADIUS = 6;
/** Radius of the ring drawn around the anchor a ground aim would grab. */
export const TONGUE_HIGHLIGHT_RADIUS = 20;

/**
 * How far the frog's mouth sits above the surface it is standing on — the height
 * every tongue shot starts from, and the first term of the reach budget the
 * level generator spends (see GAP_MAX).
 */
export const MOUTH_ABOVE_SURFACE = FROG_HALF_H - TONGUE_MOUTH_Y;

// ---------------------------------------------------------------------------
// Walls
// ---------------------------------------------------------------------------

/**
 * Flying into either edge of the world now clings instead of wrapping around
 * to the opposite side — wrapping only ever read sensibly when the camera
 * showed the whole DESIGN_WIDTH at once, which stops being true once Eyes can
 * zoom the view in. `wallSide`/`wallTimer` on the state track the hang.
 *
 * The pause before sliding starts — long enough that a deliberate wall-tongue
 * (aim, then fire) fits inside it without a race against gravity.
 */
export const WALL_CLING_GRACE = 0.4;
/** Terminal slide speed — well under MAX_FALL_SPEED, so clinging always reads
 *  as slower than falling, never as a cosmetic pause on the way down anyway. */
export const WALL_SLIDE_SPEED = 70;
/** How fast the slide ramps up to WALL_SLIDE_SPEED once the grace period ends. */
export const WALL_SLIDE_ACCEL = 220;
/** Move-axis deflection away from the wall that lets go of it, back into a
 *  normal fall. Below AUTO_JUMP's move axis convention (±1), so a firm flick
 *  releases but noise from a resting thumb cannot. */
export const WALL_DETACH_AXIS = 0.35;

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

/** Where the frog sits vertically at rest, as a fraction of screen height. */
export const CAMERA_ANCHOR = 0.62;
/**
 * Exponential follow rate. Higher is snappier; the camera never pans back down
 * vertically. Shared with the horizontal follow below — one feel for both axes.
 */
export const CAMERA_SMOOTH = 9;

// ---------------------------------------------------------------------------
// Eyes (Frogenetics field-of-view upgrade)
// ---------------------------------------------------------------------------

/**
 * Zoom at Frogenetics level 0 — the visible window is this many times *smaller*
 * than the full DESIGN_WIDTH×DESIGN_HEIGHT frame. The live value is `zoom` on
 * the state; each Eyes level below EYES_ZOOM_STEPs it down. Level generation
 * never reads this — GAP_MAX/MAX_SPAWN_DX are already sized against the
 * *narrowest* view a level-0 run ever sees, so a zoomed-out camera only ever
 * shows more of a level that was already reachable, never less.
 */
export const EYES_ZOOM_BASE = 1.5;
/** Zoom lost per Eyes level; five levels exactly cancel EYES_ZOOM_BASE's 0.5. */
export const EYES_ZOOM_STEP = 0.1;

// ---------------------------------------------------------------------------
// Level generation
// ---------------------------------------------------------------------------

/** Keep platforms generated this far above the top of the screen. */
export const SPAWN_AHEAD = DESIGN_HEIGHT;
/** Platforms this far below the bottom of the screen return to the pool. */
export const DESPAWN_BELOW = 240;
/**
 * Vertical gap between platforms — the reach envelope of the tongue, not of
 * the auto-jump. The auto-jump alone (AUTO_JUMP_HEIGHT, 74 units at level 0)
 * can never clear GAP_MIN on its own; the tongue is what the generator is
 * built around now.
 *
 * The floor is the artwork, same as before: a platform sprite hangs up to 98
 * units below its own surface, so rows closer than ~100 units start drawing
 * through each other. The ceiling spends the reach a shot has left after
 * climbing the auto-jump apex from mouth height:
 * `MOUTH_ABOVE_SURFACE + AUTO_JUMP_HEIGHT + TONGUE_RANGE_BASE * TONGUE_GAP_RATIO`
 * — 36 + 74 + 130 * 0.58 = 185. `TONGUE_GAP_RATIO` under 1 on purpose: a shot
 * that needed its full base reach would leave a maxed-out Tongue upgrade
 * nothing further to buy.
 */
export const GAP_MIN = 105;
export const TONGUE_GAP_RATIO = 0.58;
export const GAP_MAX = MOUTH_ABOVE_SURFACE + AUTO_JUMP_HEIGHT + TONGUE_RANGE_BASE * TONGUE_GAP_RATIO;
/**
 * How far a row's platform may sit sideways from the row below it, centre to
 * centre. At the widest gap, the vertical distance from the mouth (at the
 * auto-jump apex) up to the target surface is exactly
 * `TONGUE_RANGE_BASE * TONGUE_GAP_RATIO` — that is how GAP_MAX was built —
 * so the worst case, `sqrt(MAX_SPAWN_DX^2 + (TONGUE_RANGE_BASE *
 * TONGUE_GAP_RATIO)^2)` ≈ 110, stays comfortably under TONGUE_RANGE_BASE
 * (130) even before the move joystick closes any of the gap itself.
 */
export const MAX_SPAWN_DX = 80;
/**
 * Clear width kept between a Spikes platform and the bare Small platform
 * `spawnRow` always spawns beside it — see `spawnSpikesCompanion`. Spikes is
 * the one row type that can otherwise be the *only* landing spot at its
 * height; this guarantees a hazard-free option is always in reach next to it,
 * so clearing a Spikes row is a choice of where to land, never a forced hit.
 */
export const SPIKES_COMPANION_GAP = 16;
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
/** Radius an idle enemy watches for the frog — grounded or airborne — to aggro onto. */
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
/** Bounce off a stomp kill, as a multiple of a base auto-jump — comfortably above
 *  1 so a stomp always reads as a deliberate boost, never as an ordinary landing. */
export const STOMP_BOUNCE_MULTIPLIER = 1.15;

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
// Touch
// ---------------------------------------------------------------------------

/**
 * One finger now carries only two outcomes, told apart by how long it stayed
 * down and how far it travelled: a quick, near-motionless touch is an attack;
 * anything longer or that moved further was always an aim (drawn from the
 * first frame, fired on release). There is no more separate jump gesture —
 * landings launch on their own — so the finger's only job in the air or on
 * the ground is the tongue.
 */
export const TAP_MAX_DURATION = 0.15;
export const TAP_MAX_MOVEMENT = 14;
/** How long the attack pose stays up after a tap. Placeholder until enemies exist. */
export const ATTACK_POSE_DURATION = 0.25;
export const TONGUE_COLOR = '#E0524B';
export const TONGUE_TIP_COLOR = '#F59089';
export const TONGUE_AIM_COLOR = 'rgba(255, 255, 255, 0.8)';
export const TONGUE_AIM_WIDTH = 3;

// ---------------------------------------------------------------------------
// Move joystick
// ---------------------------------------------------------------------------

/**
 * Fixed bottom-left stick that drives horizontal movement — the frog's only
 * other input now that jumping and the tongue no longer share a gesture with
 * it. Lives in its own RN view next to the canvas, not inside the canvas's
 * own GestureDetector, so a finger on the stick physically never reaches the
 * tongue/attack gesture underneath.
 */
export const JOYSTICK_BASE_RADIUS = 64;
export const JOYSTICK_KNOB_RADIUS = 32;
/** Distance from the screen's bottom-left safe-area corner to the stick's centre. */
export const JOYSTICK_MARGIN_X = 82;
export const JOYSTICK_MARGIN_BOTTOM = 82;
/**
 * Finger travel, as a fraction of `JOYSTICK_BASE_RADIUS`, below which the axis
 * reads as 0 — a thumb resting near centre should not dribble the frog
 * sideways.
 */
export const JOYSTICK_DEAD_ZONE = 0.15;
/**
 * Exponent applied to the axis past the dead zone — above 1 on purpose, so
 * the first half of the stick's travel reads as fine steering (a small push
 * is a proportionally smaller nudge) and speed only ramps up sharply near
 * full deflection. Without this a linear stick made every twitch of the
 * thumb read as a full-speed dart sideways, which is what made it feel
 * "too sensitive" despite `MOVE_SPEED_MAX` itself being a moderate speed.
 */
export const JOYSTICK_RESPONSE_CURVE = 1.8;

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
