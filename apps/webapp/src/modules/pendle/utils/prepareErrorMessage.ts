import { t } from '@lingui/core/macro';
import { revertMessage } from '@/lib/revertMessages';
import { genericPrepareErrorMessage } from '@/modules/ui/lib/enginePrepareErrorMessage';

/**
 * Maps raw Pendle prepare/revert messages to user-friendly copy. Shared by the
 * buy/sell and redeem modal flows so users see consistent guidance everywhere.
 * Any other contract revert reads as the revert registry's copy, or its raw
 * reason.
 *
 * `slippageHint` replaces the slippage-exceeded copy for flows where the
 * default guidance doesn't fit; the redeem and review grids both keep the
 * control on the Slippage cell's gear, which the default copy points at.
 */
export function pendlePrepareErrorMessage(
  error: Error | null | undefined,
  slippageHint?: string,
  fallback?: string
): string | undefined {
  const raw = error?.message;
  if (!raw) return undefined;
  if (/INSUFFICIENT_TOKEN_OUT|Slippage:/i.test(raw)) {
    return (
      slippageHint ??
      t`Current market price exceeds your slippage tolerance. Increase slippage via the gear icon on the Slippage row, or wait for the quote to refresh.`
    );
  }
  if (/quote/i.test(raw) && /stale|expired/i.test(raw)) {
    return t`Quote expired. Refreshing — please wait a moment.`;
  }
  return (
    revertMessage(error) ??
    fallback ??
    t`Unable to prepare transaction. Please try again or adjust your inputs.`
  );
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

/**
 * Why a matured position's claim can't be prepared. Sorts errors into the same
 * cases as pendleQuoteErrorMessage, with claim wording only where its advice
 * differs: a claim always takes the whole balance, so there is no amount to
 * change. Unlike that mapper, only an actual network failure blames the
 * connection.
 */
export function pendleClaimErrorMessage(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (/input valuation is too low/i.test(raw)) {
    return t`This position is too small to claim. Pendle can't process amounts worth less than $0.01.`;
  }
  if (/no routes/i.test(raw)) {
    return t`Pendle has no route for this payout. Try the other withdrawal token.`;
  }
  if (/malformed quote/i.test(raw)) {
    return t`Received an invalid quote from Pendle. Please try again.`;
  }
  if (/^Pendle \/convert \d+/i.test(raw)) {
    return t`Pendle can't prepare this claim right now. Please try again later.`;
  }
  // fetch's network failure messages across browsers.
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(raw)) {
    return t`Couldn't reach Pendle to prepare your claim. Check your connection and try again.`;
  }
  return genericPrepareErrorMessage();
}

/**
 * Why a matured claim with a quote still can't be signed. Slippage, stale
 * quotes and known contract reverts keep their shared copy; the generic
 * "adjust your inputs" doesn't fit a claim, which has no inputs.
 */
export function pendleClaimPrepareErrorMessage(error: Error | null | undefined): string | undefined {
  return pendlePrepareErrorMessage(error, undefined, genericPrepareErrorMessage());
}
