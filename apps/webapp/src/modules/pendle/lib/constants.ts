export enum PendleFlow {
  BUY = 'buy',
  WITHDRAW = 'withdraw'
}

export const PENDLE_BUY_SLIPPAGE_STORAGE_KEY = 'pendle-buy-slippage';
export const PENDLE_SELL_SLIPPAGE_STORAGE_KEY = 'pendle-sell-slippage';
/** Matured-PT redeem flow gets its own key — separate default from buy/sell
 * so users can hold a different tolerance per flow. */
export const PENDLE_REDEEM_SLIPPAGE_STORAGE_KEY = 'pendle-redeem-slippage';
/** 0.02% — applied to matured-PT redeem (vs. 0.2% for buy/sell). */
export const PENDLE_DEFAULT_REDEEM_SLIPPAGE = 0.0002;
