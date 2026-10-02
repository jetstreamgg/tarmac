export enum PendleFlow {
  BUY = 'buy',
  WITHDRAW = 'withdraw'
}

// Pendle's /v1/pnl/transactions indexer lag is empirically ~19s after the
// block is mined (n=2 against a real wallet, May 2026 — both samples in
// 17.3–21.3s, suggesting a steady ~20s poll on Pendle's side rather than a
// long tail). 25s gives a 4–8s safety margin; rare outliers beyond that are
// covered by `refetchOnWindowFocus` and `staleTime: 0` on the shared query.
// Much higher than the global REFRESH_DELAY (1s) the other widgets use
// because those histories are powered by our Envio Hyperindex (or the Morpho
// API for vaults), which surface new rows within a block. Pendle's PnL
// endpoint is a third-party indexer we don't control — re-measure if it
// changes.
export const PENDLE_HISTORY_REFRESH_MS = 25_000;

export const PENDLE_BUY_SLIPPAGE_STORAGE_KEY = 'pendle-buy-slippage';
export const PENDLE_SELL_SLIPPAGE_STORAGE_KEY = 'pendle-sell-slippage';
/** Matured-PT redeem flow gets its own key — separate default from buy/sell
 * so users can hold a different tolerance per flow. */
export const PENDLE_REDEEM_SLIPPAGE_STORAGE_KEY = 'pendle-redeem-slippage';
/** 0.02% — applied to matured-PT redeem (vs. 0.2% for buy/sell). */
export const PENDLE_DEFAULT_REDEEM_SLIPPAGE = 0.0002;
