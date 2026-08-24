/**
 * Rewarded video via Start.io.
 *
 * Banners and interstitials are deliberately absent — rewarded video is the
 * only ad format. Everything here sits behind a narrow interface so the
 * underlying SDK can be swapped without touching UI code.
 *
 * The App IDs are supplied through `expo.extra.startIo` in app.json. Until
 * they are set the SDK runs in test mode so the flows remain playable.
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { reportEvent } from '@/services/analytics';
import { pauseMusicForAd, resumeMusicAfterAd } from '@/services/audio';

type StartIoModule = typeof import('react-native-start-io-sdk');

let sdk: StartIoModule | null = null;
let initialized = false;

/** Resolved lazily: importing pulls in a Nitro module that Expo Go and web cannot provide. */
function loadModule(): StartIoModule | null {
  if (Platform.OS === 'web') return null;
  if (sdk) return sdk;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy load so Expo Go (no Nitro modules) doesn't crash on import
    sdk = require('react-native-start-io-sdk') as StartIoModule;
    return sdk;
  } catch {
    return null;
  }
}

function appIds() {
  const extra = (Constants.expoConfig?.extra ?? {}) as {
    startIo?: { androidAppId?: string; iosAppId?: string };
  };
  return {
    androidAppId: extra.startIo?.androidAppId ?? '',
    iosAppId: extra.startIo?.iosAppId ?? '',
  };
}

/**
 * Whether a real Start.io App ID has been supplied.
 *
 * Ad-gated UI must check this and hide itself entirely while it's `false`,
 * so the app never shows an ad affordance it can't back with a real ad.
 * Filling in `expo.extra.startIo` in app.json is the only step needed to
 * light everything back up — no other code changes required.
 */
export function adsEnabled(): boolean {
  const { androidAppId, iosAppId } = appIds();
  return Boolean(androidAppId || iosAppId);
}

export function initAds() {
  if (initialized) return;
  const module = loadModule();
  if (!module) {
    if (__DEV__) console.warn('[ads] Start.io module unavailable (expected in Expo Go)');
    return;
  }

  const { androidAppId, iosAppId } = appIds();
  const configured = Boolean(androidAppId || iosAppId);
  if (!configured && __DEV__) {
    console.warn('[ads] No Start.io App ID configured; running in test mode');
  }

  try {
    module.initializeStartIoSdk({
      androidAppId: androidAppId || 'TEST',
      iOSAppId: iosAppId || 'TEST',
      // Live ads require real IDs; without them only test creatives can fill.
      testAd: !configured,
    });
    initialized = true;
    void preloadRewarded();
  } catch (error) {
    if (__DEV__) console.warn('[ads] initialization failed', error);
  }
}

/** Warms the next rewarded video so the button does not stall when tapped. */
export async function preloadRewarded() {
  const module = loadModule();
  if (!module || !initialized) return;
  try {
    await module.loadAd(module.AdType.REWARDED_VIDEO);
  } catch (error) {
    if (__DEV__) console.warn('[ads] preload failed', error);
  }
}

/**
 * Shows a rewarded video and resolves with whether the reward was actually earned.
 *
 * Callers must only grant the reward when this resolves `true`.
 */
export function showRewarded(source: string): Promise<boolean> {
  reportEvent('rewarded_ad', { action: 'view', source });

  const module = loadModule();
  if (!module || !initialized) {
    // Without the native module there is no ad to watch. In development the reward
    // is granted anyway so the surrounding flows stay testable in Expo Go; release
    // builds always run through the real SDK.
    if (__DEV__) {
      console.warn(`[ads] no SDK for "${source}"; granting reward in dev only`);
      reportEvent('rewarded_ad', { action: 'reward', source });
      return Promise.resolve(true);
    }
    reportEvent('rewarded_ad', { action: 'error', source });
    return Promise.resolve(false);
  }

  return new Promise<boolean>((resolve) => {
    let earned = false;
    let settled = false;

    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resumeMusicAfterAd();
      reportEvent('rewarded_ad', { action: value ? 'reward' : 'error', source });
      // Get the next video in flight for the following tap.
      void preloadRewarded();
      resolve(value);
    };

    // Guard against an SDK that never reports a terminal state.
    const timeout = setTimeout(() => settle(earned), 90_000);

    const run = async () => {
      try {
        await module.loadAd(module.AdType.REWARDED_VIDEO);
        // Paused only once the video is actually about to play, so a slow fill
        // does not leave the app sitting in silence.
        pauseMusicForAd();
        module.showAd((result) => {
          switch (result) {
            case module.AdResultType.AdRewarded:
              earned = true;
              break;
            case module.AdResultType.AdHidden:
              settle(earned);
              break;
            case module.AdResultType.AdNotDisplayed:
              settle(false);
              break;
            default:
              // Displayed and clicked are progress signals, not terminal states.
              break;
          }
        });
      } catch (error) {
        if (__DEV__) console.warn(`[ads] failed to show for "${source}"`, error);
        settle(false);
      }
    };

    void run();
  });
}
