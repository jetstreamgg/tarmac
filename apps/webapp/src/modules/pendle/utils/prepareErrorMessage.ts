import { t } from '@lingui/core/macro';

/**
 * Maps raw Pendle prepare/revert messages to user-friendly copy. Shared by the
 * buy/sell and redeem modal flows so users see consistent guidance everywhere.
 */
export function pendlePrepareErrorMessage(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (/INSUFFICIENT_TOKEN_OUT|Slippage:/i.test(raw)) {
    return t`Current market price exceeds your slippage tolerance. Increase slippage via the gear icon, or wait for the quote to refresh.`;
  }
  if (/quote/i.test(raw) && /stale|expired/i.test(raw)) {
    return t`Quote expired. Refreshing — please wait a moment.`;
  }
  return t`Unable to prepare transaction. Please try again or adjust your inputs.`;
}
