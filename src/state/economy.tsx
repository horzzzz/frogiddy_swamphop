import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { WEAPONS } from '@/constants/weapons';

const STORAGE_KEY = 'frogiddy-swamphop/wallet/v1';

export const DAILY_BONUS_AMOUNT = 1000;
/** Daily bonus chest resets once per day. */
export const DAILY_BONUS_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** Wheel of Luck resets once per day, same as the chest — free spins bypass this. */
export const WHEEL_SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type WalletData = {
  coins: number;
  /** Crystals — the currency runs pay out alongside coins, spent on weapons. */
  crystals: number;
  /** Best height reached in a single run, in metres. Shown as "Highest" on the game HUD. */
  bestHeight: number;
  lastDailyBonusAt: number | null;
  freeSpins: number;
  lastWheelSpinAt: number | null;
  /** Ids of weapons bought in the Arsenal. */
  ownedWeapons: string[];
  /**
   * Which owned weapon's reach applies in a run, or null for the unarmed
   * default. Always one of `ownedWeapons` — enforced in `reconcile` and in
   * every setter below, rather than trusted at the read site.
   */
  equippedWeapon: string | null;
  /** True once the player has ever collected crystals — unlocks the Arsenal for good, even if spent back to 0. */
  crystalsFound: boolean;
  /** True once the player has ever collected coins — unlocks Frogenetics for good, even if spent back to 0. */
  coinsFound: boolean;
};

const INITIAL_WALLET: WalletData = {
  coins: 0,
  crystals: 0,
  bestHeight: 0,
  lastDailyBonusAt: null,
  freeSpins: 0,
  lastWheelSpinAt: null,
  ownedWeapons: [],
  equippedWeapon: null,
  crystalsFound: false,
  coinsFound: false,
};

/** Priciest owned weapon, since price is the reach ladder — or null if none owned. */
function bestOwnedWeapon(ownedWeapons: string[]): string | null {
  const owned = WEAPONS.filter((weapon) => ownedWeapons.includes(weapon.id));
  if (owned.length === 0) return null;
  return owned.reduce((best, weapon) => (weapon.price > best.price ? weapon : best)).id;
}

/** Merges a persisted blob into the current shape so older saves keep working. */
function reconcile(raw: unknown): WalletData {
  if (!raw || typeof raw !== 'object') return INITIAL_WALLET;
  const saved = raw as Partial<WalletData>;

  const ownedWeapons = Array.isArray(saved.ownedWeapons)
    ? saved.ownedWeapons.filter((id): id is string => typeof id === 'string')
    : [];
  const equippedWeapon =
    typeof saved.equippedWeapon === 'string' && ownedWeapons.includes(saved.equippedWeapon)
      ? saved.equippedWeapon
      : bestOwnedWeapon(ownedWeapons);

  return {
    coins: Number.isFinite(saved.coins) ? Math.max(0, Math.floor(saved.coins as number)) : 0,
    crystals: Number.isFinite(saved.crystals) ? Math.max(0, Math.floor(saved.crystals as number)) : 0,
    bestHeight: Number.isFinite(saved.bestHeight) ? Math.max(0, saved.bestHeight as number) : 0,
    lastDailyBonusAt: typeof saved.lastDailyBonusAt === 'number' ? saved.lastDailyBonusAt : null,
    freeSpins: Number.isFinite(saved.freeSpins) ? Math.max(0, Math.floor(saved.freeSpins as number)) : 0,
    lastWheelSpinAt: typeof saved.lastWheelSpinAt === 'number' ? saved.lastWheelSpinAt : null,
    ownedWeapons,
    equippedWeapon,
    crystalsFound: saved.crystalsFound === true || (Number.isFinite(saved.crystals) && (saved.crystals as number) > 0),
    coinsFound: saved.coinsFound === true || (Number.isFinite(saved.coins) && (saved.coins as number) > 0),
  };
}

type EconomyContextValue = {
  /** False until the save file has been read. */
  ready: boolean;
  coins: number;
  crystals: number;
  bestHeight: number;
  lastDailyBonusAt: number | null;
  freeSpins: number;
  lastWheelSpinAt: number | null;
  ownedWeapons: string[];
  equippedWeapon: string | null;
  crystalsFound: boolean;
  coinsFound: boolean;
  /** General-purpose primitives for any coin source: quests, wheel, shop refunds, etc. */
  addCoins: (amount: number) => void;
  /** Returns false without changing the balance if it would go negative. */
  spendCoins: (amount: number) => boolean;
  claimDailyBonus: () => void;
  /**
   * Banks one finished run: currencies are added and the height record is raised
   * if it was beaten. The game loop calls this once at the end of a run rather
   * than per pickup, so a run never costs more than one React update.
   */
  recordRun: (coins: number, crystals: number, meters: number) => void;
  grantFreeSpins: (amount: number) => void;
  /**
   * Consumes one attempt: a free spin if available, otherwise starts the daily
   * cooldown. Returns false without changing anything if neither is available.
   */
  spinWheel: () => boolean;
  /**
   * Buys one Arsenal weapon with crystals and equips it immediately — a
   * purchase you just made is the one you presumably want to use. Returns
   * false without changing anything if it's already owned or the balance is
   * too low.
   */
  buyWeapon: (id: string, price: number) => boolean;
  /** Switches which owned weapon applies in a run. No-ops if `id` isn't owned. */
  equipWeapon: (id: string) => void;
};

const EconomyContext = createContext<EconomyContextValue | null>(null);

export function EconomyProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<WalletData>(INITIAL_WALLET);
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return;
        if (stored) setWallet(reconcile(JSON.parse(stored)));
      })
      .catch(() => {
        // A corrupt or unreadable save should not block startup; fall back to defaults.
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist on change, coalescing bursts into one write.
  useEffect(() => {
    if (!ready) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(wallet)).catch(() => {});
    }, 250);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [wallet, ready]);

  const addCoins = useCallback((amount: number) => {
    if (amount <= 0) return;
    setWallet((prev) => ({ ...prev, coins: prev.coins + Math.floor(amount), coinsFound: true }));
  }, []);

  const spendCoins = useCallback((amount: number) => {
    let ok = false;
    setWallet((prev) => {
      if (amount <= 0 || prev.coins < amount) return prev;
      ok = true;
      return { ...prev, coins: prev.coins - amount };
    });
    return ok;
  }, []);

  const claimDailyBonus = useCallback(() => {
    setWallet((prev) => ({
      ...prev,
      coins: prev.coins + DAILY_BONUS_AMOUNT,
      lastDailyBonusAt: Date.now(),
    }));
  }, []);

  const recordRun = useCallback((coins: number, crystals: number, meters: number) => {
    const gainedCoins = Math.max(0, Math.floor(coins));
    const gainedCrystals = Math.max(0, Math.floor(crystals));
    setWallet((prev) => ({
      ...prev,
      coins: prev.coins + gainedCoins,
      crystals: prev.crystals + gainedCrystals,
      bestHeight: Math.max(prev.bestHeight, meters),
      crystalsFound: prev.crystalsFound || gainedCrystals > 0,
      coinsFound: prev.coinsFound || gainedCoins > 0,
    }));
  }, []);

  const grantFreeSpins = useCallback((amount: number) => {
    if (amount <= 0) return;
    setWallet((prev) => ({ ...prev, freeSpins: prev.freeSpins + Math.floor(amount) }));
  }, []);

  const spinWheel = useCallback(() => {
    let ok = false;
    setWallet((prev) => {
      if (prev.freeSpins > 0) {
        ok = true;
        return { ...prev, freeSpins: prev.freeSpins - 1 };
      }
      if (cooldownRemaining(prev.lastWheelSpinAt, WHEEL_SPIN_COOLDOWN_MS) > 0) return prev;
      ok = true;
      return { ...prev, lastWheelSpinAt: Date.now() };
    });
    return ok;
  }, []);

  const buyWeapon = useCallback((id: string, price: number) => {
    let ok = false;
    setWallet((prev) => {
      if (prev.ownedWeapons.includes(id) || prev.crystals < price) return prev;
      ok = true;
      return {
        ...prev,
        crystals: prev.crystals - price,
        ownedWeapons: [...prev.ownedWeapons, id],
        equippedWeapon: id,
      };
    });
    return ok;
  }, []);

  const equipWeapon = useCallback((id: string) => {
    setWallet((prev) => (prev.ownedWeapons.includes(id) ? { ...prev, equippedWeapon: id } : prev));
  }, []);

  const value = useMemo<EconomyContextValue>(
    () => ({
      ready,
      coins: wallet.coins,
      crystals: wallet.crystals,
      bestHeight: wallet.bestHeight,
      lastDailyBonusAt: wallet.lastDailyBonusAt,
      freeSpins: wallet.freeSpins,
      lastWheelSpinAt: wallet.lastWheelSpinAt,
      ownedWeapons: wallet.ownedWeapons,
      equippedWeapon: wallet.equippedWeapon,
      crystalsFound: wallet.crystalsFound,
      coinsFound: wallet.coinsFound,
      addCoins,
      spendCoins,
      claimDailyBonus,
      recordRun,
      grantFreeSpins,
      spinWheel,
      buyWeapon,
      equipWeapon,
    }),
    [
      ready,
      wallet,
      addCoins,
      spendCoins,
      claimDailyBonus,
      recordRun,
      grantFreeSpins,
      spinWheel,
      buyWeapon,
      equipWeapon,
    ]
  );

  return <EconomyContext.Provider value={value}>{children}</EconomyContext.Provider>;
}

export function useEconomy() {
  const context = useContext(EconomyContext);
  if (!context) throw new Error('useEconomy must be used inside EconomyProvider');
  return context;
}

/** Milliseconds until a cooldown started at `startedAt` clears, or 0 when it's ready. */
export function cooldownRemaining(startedAt: number | null, cooldownMs: number, now = Date.now()) {
  if (startedAt === null) return 0;
  return Math.max(0, startedAt + cooldownMs - now);
}
