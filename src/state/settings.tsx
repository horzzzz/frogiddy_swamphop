import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { applyAudioSettings, playSfx, setMusicEnabled, setSfxEnabled } from '@/services/audio';

const STORAGE_KEY = 'frogiddy-swamphop/settings/v1';

export type SettingsData = {
  /** Background music, the one track shared by the menu and the game. */
  musicOn: boolean;
  /** Every one-shot effect: buttons, wheel, pickups, hits, damage, defeat. */
  soundOn: boolean;
  /**
   * Held and persisted like the rest, but nothing reads them yet — the app has
   * no haptics and no push. They stay here so the switches keep their position
   * between visits instead of silently resetting.
   */
  vibrationOn: boolean;
  notificationsOn: boolean;
};

const INITIAL_SETTINGS: SettingsData = {
  musicOn: true,
  soundOn: true,
  vibrationOn: true,
  notificationsOn: false,
};

/** Merges a persisted blob into the current shape so older saves keep working. */
function reconcile(raw: unknown): SettingsData {
  if (!raw || typeof raw !== 'object') return INITIAL_SETTINGS;
  const saved = raw as Partial<SettingsData>;

  return {
    musicOn: saved.musicOn !== false,
    soundOn: saved.soundOn !== false,
    vibrationOn: saved.vibrationOn !== false,
    notificationsOn: saved.notificationsOn === true,
  };
}

type SettingsContextValue = SettingsData & {
  /** False until the save file has been read. */
  ready: boolean;
  setMusicOn: (value: boolean) => void;
  setSoundOn: (value: boolean) => void;
  setVibrationOn: (value: boolean) => void;
  setNotificationsOn: (value: boolean) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SettingsData>(INITIAL_SETTINGS);
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      let restored = INITIAL_SETTINGS;
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) restored = reconcile(JSON.parse(stored));
      } catch {
        // A corrupt or unreadable save should not block startup; fall back to defaults.
      }
      if (cancelled) return;

      setSettings(restored);
      // The audio service holds playback until this lands, so it has to run on
      // the failure path too — otherwise a bad save file means a silent app.
      applyAudioSettings(restored);
      setReady(true);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist on change, coalescing bursts into one write.
  useEffect(() => {
    if (!ready) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings)).catch(() => {});
    }, 250);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [settings, ready]);

  const setMusicOn = useCallback((value: boolean) => {
    setMusicEnabled(value);
    setSettings((prev) => ({ ...prev, musicOn: value }));
  }, []);

  const setSoundOn = useCallback((value: boolean) => {
    setSfxEnabled(value);
    // The switch's own click was swallowed while sound was still off, so
    // turning it back on plays one — otherwise the only switch whose effect
    // you cannot hear is the one that controls hearing.
    if (value) playSfx('click');
    setSettings((prev) => ({ ...prev, soundOn: value }));
  }, []);

  const setVibrationOn = useCallback((value: boolean) => {
    setSettings((prev) => ({ ...prev, vibrationOn: value }));
  }, []);

  const setNotificationsOn = useCallback((value: boolean) => {
    setSettings((prev) => ({ ...prev, notificationsOn: value }));
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      ready,
      ...settings,
      setMusicOn,
      setSoundOn,
      setVibrationOn,
      setNotificationsOn,
    }),
    [ready, settings, setMusicOn, setSoundOn, setVibrationOn, setNotificationsOn]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used inside SettingsProvider');
  return context;
}
