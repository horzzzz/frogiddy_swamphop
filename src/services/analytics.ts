/**
 * AppMetrica reporting.
 */

import { Platform } from 'react-native';

type AppMetricaModule = typeof import('@appmetrica/react-native-analytics').default;

const API_KEY = '53c70b54-a430-4a7b-bd8f-02004d829dfa';

let sdk: AppMetricaModule | null = null;
let activated = false;

/** Resolved lazily: AppMetrica is a native-only module with no web build. */
function loadModule(): AppMetricaModule | null {
  if (Platform.OS === 'web') return null;
  if (sdk) return sdk;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy load so Expo Go/web don't crash on import
    sdk = (require('@appmetrica/react-native-analytics') as { default: AppMetricaModule }).default;
    return sdk;
  } catch {
    return null;
  }
}

export function initAnalytics() {
  if (activated) return;
  const module = loadModule();
  if (!module) return;
  try {
    module.activate({
      apiKey: API_KEY,
      sessionTimeout: 60,
      crashReporting: true,
      logs: __DEV__,
      sessionsAutoTracking: true,
      appOpenTrackingEnabled: true,
    });
    activated = true;
  } catch (error) {
    // The native module is missing in Expo Go; the app still has to run.
    if (__DEV__) console.warn('[analytics] AppMetrica unavailable', error);
  }
}

/** Calls into the native reporter, swallowing failures so analytics never breaks the app. */
export function reportEvent(event: string, attributes: Record<string, unknown> = {}) {
  if (!activated || !sdk) return;
  try {
    sdk.reportEvent(event, attributes);
  } catch (error) {
    if (__DEV__) console.warn(`[analytics] failed to report "${event}"`, error);
  }
}
