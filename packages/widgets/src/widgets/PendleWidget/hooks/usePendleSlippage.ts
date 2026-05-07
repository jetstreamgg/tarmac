import { useCallback, useEffect, useState } from 'react';
import { PENDLE_DEFAULT_SLIPPAGE } from '@jetstreamgg/sky-hooks';
import {
  PendleFlow,
  PENDLE_BUY_SLIPPAGE_STORAGE_KEY,
  PENDLE_SELL_SLIPPAGE_STORAGE_KEY,
  PENDLE_REDEEM_SLIPPAGE_STORAGE_KEY,
  PENDLE_DEFAULT_REDEEM_SLIPPAGE
} from '../lib/constants';

/** Mode discriminator for the slippage hook. `'redeem'` is the matured-PT
 * redeem flow — separate storage key and a wider default than buy/sell. */
export type PendleSlippageMode = PendleFlow | 'redeem';

const readStoredSlippage = (key: string, fallback: number): number => {
  if (typeof window === 'undefined') return fallback;
  const stored = window.localStorage.getItem(key);
  if (!stored) return fallback;
  const parsed = Number(stored);
  if (Number.isNaN(parsed) || parsed < 0) return fallback;
  return parsed;
};

const writeStoredSlippage = (key: string, decimal: number) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, String(decimal));
};

function resolveStorageConfig(mode: PendleSlippageMode): {
  storageKey: string;
  defaultSlippage: number;
} {
  if (mode === 'redeem') {
    return {
      storageKey: PENDLE_REDEEM_SLIPPAGE_STORAGE_KEY,
      defaultSlippage: PENDLE_DEFAULT_REDEEM_SLIPPAGE
    };
  }
  return {
    storageKey: mode === PendleFlow.BUY ? PENDLE_BUY_SLIPPAGE_STORAGE_KEY : PENDLE_SELL_SLIPPAGE_STORAGE_KEY,
    defaultSlippage: PENDLE_DEFAULT_SLIPPAGE
  };
}

/**
 * Per-mode slippage state with localStorage persistence. Each of Buy / Sell /
 * Redeem keeps its own key so users can hold different tolerances per flow.
 */
export function usePendleSlippage(mode: PendleSlippageMode) {
  const { storageKey, defaultSlippage } = resolveStorageConfig(mode);

  const [slippage, setSlippageRaw] = useState<number>(() => readStoredSlippage(storageKey, defaultSlippage));

  useEffect(() => {
    setSlippageRaw(readStoredSlippage(storageKey, defaultSlippage));
  }, [storageKey, defaultSlippage]);

  const setSlippage = useCallback(
    (decimal: number) => {
      setSlippageRaw(decimal);
      writeStoredSlippage(storageKey, decimal);
    },
    [storageKey]
  );

  return { slippage, setSlippage, defaultSlippage };
}
