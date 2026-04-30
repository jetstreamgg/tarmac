import { useEffect, useMemo, useState } from 'react';
import {
  isMarketMatured,
  PENDLE_DEFAULT_SLIPPAGE,
  type PendleMarketConfig
} from '@jetstreamgg/sky-hooks';
import {
  PendleFlow,
  PendleScreen,
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
 * Local widget state composer. Holds tab/screen/amount/slippage and derives the
 * current default-slippage value for the active flow + maturity state. Read-only
 * for now — no real tx submission wired.
 */
export function usePendleWidgetState(market: PendleMarketConfig, initialFlow: PendleFlow = PendleFlow.BUY) {
  const matured = isMarketMatured(market.expiry);
  const [flow, setFlow] = useState<PendleFlow>(initialFlow);
  const [screen, setScreen] = useState<PendleScreen>(PendleScreen.ACTION);
  const [amount, setAmount] = useState<bigint>(0n);

  // The hooks layer collapsed per-flow slippage defaults into a single value
  // (0.2% for Buy / Sell / Redeem) — keep the per-flow shape here so we can
  // re-introduce a different default per flow later without touching callers.
  const defaultSlippage = useMemo(() => {
    void flow;
    void matured;
    return PENDLE_DEFAULT_SLIPPAGE;
  }, [flow, matured]);

  const storageKey =
    flow === PendleFlow.BUY ? PENDLE_BUY_SLIPPAGE_STORAGE_KEY : PENDLE_SELL_SLIPPAGE_STORAGE_KEY;

  const [slippage, setSlippageRaw] = useState<number>(() =>
    readStoredSlippage(storageKey, defaultSlippage)
  );

  // Re-load persisted slippage when the active flow changes (Buy ↔ Withdraw).
  useEffect(() => {
    setSlippageRaw(readStoredSlippage(storageKey, defaultSlippage));
  }, [storageKey, defaultSlippage]);

  const setSlippage = (decimal: number) => {
    setSlippageRaw(decimal);
    writeStoredSlippage(storageKey, decimal);
  };

  // Reset the input amount when the user flips tabs — supply and withdraw
  // amounts have different decimals and different meanings.
  const onFlowChange = (next: PendleFlow) => {
    setFlow(next);
    setAmount(0n);
    setScreen(PendleScreen.ACTION);
  };

  return {
    flow,
    setFlow: onFlowChange,
    screen,
    setScreen,
    amount,
    setAmount,
    slippage,
    setSlippage,
    defaultSlippage,
    isRedeemMode: matured && flow === PendleFlow.WITHDRAW
  };
}
