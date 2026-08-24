/**
 * Music and sound effects.
 *
 * Everything lives in module scope rather than in React state on purpose: the
 * menu and the game are different routes, and a player owned by a screen would
 * be torn down and recreated on every navigation — which is exactly what makes
 * background music restart mid-track. These players are created once and live
 * for the lifetime of the process.
 *
 * Nothing here ever throws into a caller. A game loop that has to guard every
 * `playSfx` with its own try/catch would be worse than a game that occasionally
 * runs silent, so every native call is wrapped locally instead.
 */

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { AppState, InteractionManager } from 'react-native';

export type SfxName = 'click' | 'pickup' | 'hit' | 'hurt' | 'lose' | 'wheel';

type SfxSpec = {
  source: number;
  /**
   * How many players to allocate for this sound. More than one lets a second
   * trigger overlap the first instead of cutting it off — coins collected in
   * quick succession are the obvious case.
   */
  voices: number;
  volume: number;
  /** Minimum gap between two triggers. Caps how much work a burst can queue up. */
  throttleMs: number;
};

const SFX: Record<SfxName, SfxSpec> = {
  click: { source: require('@/assets/audio/sfx-click.m4a'), voices: 2, volume: 0.45, throttleMs: 40 },
  pickup: { source: require('@/assets/audio/sfx-pickup.m4a'), voices: 2, volume: 0.7, throttleMs: 60 },
  hit: { source: require('@/assets/audio/sfx-hit.m4a'), voices: 2, volume: 0.75, throttleMs: 60 },
  hurt: { source: require('@/assets/audio/sfx-hurt.m4a'), voices: 1, volume: 0.85, throttleMs: 150 },
  lose: { source: require('@/assets/audio/sfx-lose.m4a'), voices: 1, volume: 0.85, throttleMs: 500 },
  wheel: { source: require('@/assets/audio/sfx-wheel.m4a'), voices: 1, volume: 0.8, throttleMs: 0 },
};

const MUSIC_SOURCE = require('@/assets/audio/music-swamp.m4a');
/** Background music sits well under the effects — it is atmosphere, not a signal. */
const MUSIC_VOLUME = 0.35;

/**
 * The wheel sample runs 2.4s, the spin animation 4.2s. Slowing playback to
 * cover the whole spin keeps the ratchet ticking until the wheel actually
 * stops, instead of falling silent while it is still visibly turning.
 */
const WHEEL_PLAYBACK_RATE = 0.6;
/** Steps of the fade that ends the wheel sound, so it never cuts off mid-tick. */
const WHEEL_FADE_STEPS = 8;
const WHEEL_FADE_STEP_MS = 20;

/**
 * Nothing reads playback status, so the default 500ms status stream from every
 * player would be pure bridge traffic. Push it out of the way.
 */
const PLAYER_OPTIONS = { updateInterval: 60_000 };

let initialized = false;
let musicPlayer: AudioPlayer | null = null;
const voicePools = new Map<SfxName, AudioPlayer[]>();
const nextVoice = new Map<SfxName, number>();
const lastPlayedAt = new Map<SfxName, number>();

/**
 * Playback is held back until the saved settings have been read, so a player
 * who turned the music off never hears a burst of it at launch.
 */
let settingsReady = false;
let musicEnabled = true;
let sfxEnabled = true;
let backgrounded = false;
let adPlaying = false;
let wheelFadeTimer: ReturnType<typeof setInterval> | null = null;

function warn(message: string, error: unknown) {
  if (__DEV__) console.warn(`[audio] ${message}`, error);
}

/** Music plays only when every reason to be silent is absent. */
function syncMusic() {
  const player = musicPlayer;
  if (!player || !settingsReady) return;

  try {
    if (musicEnabled && !backgrounded && !adPlaying) player.play();
    else player.pause();
  } catch (error) {
    warn('music play/pause failed', error);
  }
}

/**
 * Players for one effect, created on first use and kept forever. Called from
 * the warm-up below for every effect, so in practice the lazy branch only runs
 * if a button is somehow tapped before the warm-up got its turn.
 */
function voicesFor(name: SfxName): AudioPlayer[] {
  const existing = voicePools.get(name);
  if (existing) return existing;

  const spec = SFX[name];
  const players: AudioPlayer[] = [];
  try {
    for (let i = 0; i < spec.voices; i += 1) {
      const player = createAudioPlayer(spec.source, PLAYER_OPTIONS);
      player.volume = spec.volume;
      players.push(player);
    }
    if (name === 'wheel' && players[0]) {
      players[0].shouldCorrectPitch = true;
      players[0].setPlaybackRate(WHEEL_PLAYBACK_RATE, 'high');
    }
  } catch (error) {
    warn(`could not create players for "${name}"`, error);
  }

  voicePools.set(name, players);
  return players;
}

/** Decodes and uploads every effect ahead of time so the first tap is not the one that pays for it. */
function warmSfx() {
  for (const name of Object.keys(SFX) as SfxName[]) voicesFor(name);
}

async function bootstrap() {
  try {
    await setAudioModeAsync({
      // Respect the hardware silent switch: a game that blares in a meeting is a bug report.
      playsInSilentMode: false,
      // The music is tied to using the app; there is nothing to keep alive once it is backgrounded.
      shouldPlayInBackground: false,
      // Never steal the session from whatever the player already had running.
      interruptionMode: 'mixWithOthers',
    });
  } catch (error) {
    warn('audio mode setup failed', error);
  }

  try {
    const player = createAudioPlayer(MUSIC_SOURCE, PLAYER_OPTIONS);
    player.loop = true;
    player.volume = MUSIC_VOLUME;
    musicPlayer = player;
  } catch (error) {
    warn('music player creation failed', error);
  }

  syncMusic();
  // Effects are warmed after the first screen has settled — decoding seven files
  // during the opening animation is exactly the kind of hitch nobody attributes
  // to audio.
  InteractionManager.runAfterInteractions(warmSfx);
}

/** Sets up the audio session and the music player. Safe to call more than once. */
export function initAudio() {
  if (initialized) return;
  initialized = true;

  AppState.addEventListener('change', (state) => {
    // Only a real trip to the background counts. iOS reports 'inactive' for
    // transient overlays (control centre, a call banner), and pausing on those
    // would make the music stutter for no reason.
    backgrounded = state === 'background';
    syncMusic();
  });

  void bootstrap();
}

/**
 * Applies the persisted settings and unblocks playback. Called by the settings
 * provider once the save file has been read — including when reading it failed,
 * in which case the defaults come through.
 */
export function applyAudioSettings(settings: { musicOn: boolean; soundOn: boolean }) {
  musicEnabled = settings.musicOn;
  sfxEnabled = settings.soundOn;
  settingsReady = true;
  if (!sfxEnabled) stopWheelSpin();
  syncMusic();
}

/** Turns the music on or off. Resumes from where it stopped rather than restarting the track. */
export function setMusicEnabled(enabled: boolean) {
  musicEnabled = enabled;
  syncMusic();
}

/** Turns every one-shot effect on or off. */
export function setSfxEnabled(enabled: boolean) {
  sfxEnabled = enabled;
  if (!enabled) stopWheelSpin();
}

/** Plays one effect, unless sound is off or the same effect just played. */
export function playSfx(name: SfxName) {
  if (!sfxEnabled) return;

  const spec = SFX[name];
  const now = Date.now();
  if (now - (lastPlayedAt.get(name) ?? 0) < spec.throttleMs) return;
  lastPlayedAt.set(name, now);

  const voices = voicesFor(name);
  if (voices.length === 0) return;

  const index = ((nextVoice.get(name) ?? -1) + 1) % voices.length;
  nextVoice.set(name, index);
  const player = voices[index];

  try {
    // A player that already finished sits at the end of its clip, so rewinding
    // is what makes the second tap audible at all.
    void player.seekTo(0).catch(() => {});
    player.play();
  } catch (error) {
    warn(`playback failed for "${name}"`, error);
  }
}

/** Starts the wheel ratchet, stretched to cover the whole spin animation. */
export function startWheelSpin() {
  if (!sfxEnabled) return;

  if (wheelFadeTimer) {
    clearInterval(wheelFadeTimer);
    wheelFadeTimer = null;
  }

  const player = voicesFor('wheel')[0];
  if (!player) return;

  try {
    player.volume = SFX.wheel.volume;
    void player.seekTo(0).catch(() => {});
    player.play();
  } catch (error) {
    warn('wheel spin playback failed', error);
  }
}

/** Fades the wheel ratchet out over ~150ms, so landing never chops a tick in half. */
export function stopWheelSpin() {
  const player = voicePools.get('wheel')?.[0];
  if (!player) return;

  if (wheelFadeTimer) clearInterval(wheelFadeTimer);
  let step = 0;

  wheelFadeTimer = setInterval(() => {
    step += 1;
    try {
      if (step >= WHEEL_FADE_STEPS) {
        player.pause();
        player.volume = SFX.wheel.volume;
      } else {
        player.volume = SFX.wheel.volume * (1 - step / WHEEL_FADE_STEPS);
      }
    } catch (error) {
      warn('wheel fade failed', error);
      step = WHEEL_FADE_STEPS;
    }

    if (step >= WHEEL_FADE_STEPS && wheelFadeTimer) {
      clearInterval(wheelFadeTimer);
      wheelFadeTimer = null;
    }
  }, WHEEL_FADE_STEP_MS);
}

/**
 * Silences the music for the duration of a rewarded video — the ad brings its
 * own soundtrack, and the two playing over each other is not "uninterrupted
 * music", it's noise. Always pair with `resumeMusicAfterAd`.
 */
export function pauseMusicForAd() {
  adPlaying = true;
  syncMusic();
}

/** Resumes the music from where the ad interrupted it. */
export function resumeMusicAfterAd() {
  adPlaying = false;
  syncMusic();
}
