import { t } from '@lingui/core/macro';

/**
 * Maps raw Pendle prepare/revert messages to user-friendly copy. Shared by the
 * buy/sell and redeem modal flows so users see consistent guidance everywhere.
 *
 * `slippageHint` replaces the slippage-exceeded copy for flows where the
 * default "gear icon" guidance doesn't match where the slippage control
 * actually lives (the buy/sell modal keeps it on the review screen; the redeem
 * modal's header gear matches the default).
 */
export function pendlePrepareErrorMessage(
  raw: string | undefined,
  slippageHint?: string
): string | undefined {
  if (!raw) return undefined;
  if (/INSUFFICIENT_TOKEN_OUT|Slippage:/i.test(raw)) {
    return (
      slippageHint ??
      t`Current market price exceeds your slippage tolerance. Increase slippage via the gear icon, or wait for the quote to refresh.`
    );
  }
  if (/quote/i.test(raw) && /stale|expired/i.test(raw)) {
    return t`Quote expired. Refreshing — please wait a moment.`;
  }
  return t`Unable to prepare transaction. Please try again or adjust your inputs.`;
}

/**
 * Maps raw Pendle /convert quote errors (HTTP failures, malformed quotes, no
 * routes, network errors) to user-friendly copy — the retired PendleWidget's
 * mapping, so an API outage reads differently from a user mistake.
 */
export function pendleQuoteErrorMessage(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  // Pendle rejects inputs valued below $0.01 with a 400. Surfacing the generic
  // "service unavailable" copy would be misleading — the user just needs to
  // enter a larger amount.
  if (/input valuation is too low/i.test(raw)) {
    return t`Input amount is too low. Please try a larger amount.`;
  }
  if (/no routes/i.test(raw)) {
    return t`No route available for this trade size. Try a different amount.`;
  }
  if (/malformed quote/i.test(raw)) {
    return t`Received an invalid quote from Pendle. Please try again.`;
  }
  if (/^Pendle \/convert \d+/i.test(raw)) {
    return t`Pendle's quote service is temporarily unavailable. Please try again.`;
  }
  return t`Couldn't fetch a quote from Pendle. Check your connection and try again.`;
}
