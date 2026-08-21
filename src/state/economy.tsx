import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'frogiddy-swamphop/wallet/v1';

export const DAILY_BONUS_AMOUNT = 1000;
/** Daily bonus chest resets once per day. */
export const DAILY_BONUS_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type WalletData = {
  coins: number;
  lastDailyBonusAt: number | null;
};

const INITIAL_WALLET: WalletData = {
  coins: 0,
  lastDailyBonusAt: null,
};

/** Merges a persisted blob into the current shape so older saves keep working. */
function reconcile(raw: unknown): WalletData {
  if (!raw || typeof raw !== 'object') return INITIAL_WALLET;
  const saved = raw as Partial<WalletData>;

  return {
    coins: Number.isFinite(saved.coins) ? Math.max(0, Math.floor(saved.coins as number)) : 0,
    lastDailyBonusAt: typeof saved.lastDailyBonusAt === 'number' ? saved.lastDailyBonusAt : null,
  };
}

type EconomyContextValue = {
  /** False until the save file has been read. */
  ready: boolean;
  coins: number;
  lastDailyBonusAt: number | null;
  /** General-purpose primitives for any coin source: quests, wheel, shop refunds, etc. */
  addCoins: (amount: number) => void;
  /** Returns false without changing the balance if it would go negative. */
  spendCoins: (amount: number) => boolean;
  claimDailyBonus: () => void;
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
    setWallet((prev) => ({ ...prev, coins: prev.coins + Math.floor(amount) }));
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

  const value = useMemo<EconomyContextValue>(
    () => ({
      ready,
      coins: wallet.coins,
      lastDailyBonusAt: wallet.lastDailyBonusAt,
      addCoins,
      spendCoins,
      claimDailyBonus,
    }),
    [ready, wallet, addCoins, spendCoins, claimDailyBonus]
  );

  return <EconomyContext.Provider value={value}>{children}</EconomyContext.Provider>;
}

export function useEconomy() {
  const context = useContext(EconomyContext);
  if (!context) throw new Error('useEconomy must be used inside EconomyProvider');
  return context;
}

/** Milliseconds until the daily chest can be claimed again, or 0 when it is ready. */
export function dailyBonusRemaining(lastClaimAt: number | null, now = Date.now()) {
  if (lastClaimAt === null) return 0;
  return Math.max(0, lastClaimAt + DAILY_BONUS_COOLDOWN_MS - now);
}
