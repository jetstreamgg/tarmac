import { useEffect, useState } from 'react';
import { PENDLE_DEFAULT_SLIPPAGE } from '@jetstreamgg/sky-hooks';
import {
  PendleFlow,
  PENDLE_BUY_SLIPPAGE_STORAGE_KEY,
  PENDLE_SELL_SLIPPAGE_STORAGE_KEY
} from '../lib/constants';

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

/**
 * Per-flow slippage state with localStorage persistence. Buy and Sell get their
 * own keys so users can keep different defaults for each side.
 */
export function usePendleSlippage(flow: PendleFlow) {
  const defaultSlippage = PENDLE_DEFAULT_SLIPPAGE;
  const storageKey =
    flow === PendleFlow.BUY ? PENDLE_BUY_SLIPPAGE_STORAGE_KEY : PENDLE_SELL_SLIPPAGE_STORAGE_KEY;

  const [slippage, setSlippageRaw] = useState<number>(() =>
    readStoredSlippage(storageKey, defaultSlippage)
  );

  useEffect(() => {
    setSlippageRaw(readStoredSlippage(storageKey, defaultSlippage));
  }, [storageKey, defaultSlippage]);

  const setSlippage = (decimal: number) => {
    setSlippageRaw(decimal);
    writeStoredSlippage(storageKey, decimal);
  };

  return { slippage, setSlippage, defaultSlippage };
}
