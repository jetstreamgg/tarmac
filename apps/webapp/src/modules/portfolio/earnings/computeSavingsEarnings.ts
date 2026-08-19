import type {
  VaultsFyiPartialReturnsRaw,
  VaultsFyiReturnsRaw
} from '../../../hooks/vaults/fyi/vaultsFyiClient';
import { notAvailable, ok, type EarningsFigure, type EarningsWindow, type Maybe } from './types';

export type SavingsEarningsInput = {
  /** /v2/portfolio/total-returns payload (lifetime). */
  totalReturns: VaultsFyiReturnsRaw;
  /** /beta/portfolio/partial-returns payload for the month-to-date window. */
  partialReturns: VaultsFyiPartialReturnsRaw;
  window: EarningsWindow;
};

export type SavingsEarnings = {
  totalEarned: Maybe<EarningsFigure>;
  earnedThisMonth: Maybe<EarningsFigure>;
};

/** Base-unit integer string — a decimal point means the units hypothesis is wrong. */
const BASE_UNITS_PATTERN = /^-?\d+$/;

/**
 * Shared parse for both endpoints' asset+returns payload. Every gate exists
 * because NO live fixture has verified the wire values yet (key-gated API):
 * `returnsNative` is presumed base units, so a decimal string would make the
 * scaled figure wrong by 10^decimals — degrade instead of rendering it.
 */
function figureFromReturns(payload: VaultsFyiReturnsRaw): Maybe<EarningsFigure> {
  const { returnsNative, decimals, assetPriceInUsd, symbol } = payload;
  if (typeof returnsNative !== 'string' || !BASE_UNITS_PATTERN.test(returnsNative)) {
    return notAvailable('reconciliation-failed');
  }
  if (typeof decimals !== 'number' || !Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    return notAvailable('reconciliation-failed');
  }
  if (typeof symbol !== 'string' || symbol.length === 0) {
    return notAvailable('reconciliation-failed');
  }
  // Optional in the spec, but EarningsFigure.usd is not — absence degrades.
  const price = assetPriceInUsd !== undefined ? Number(assetPriceInUsd) : NaN;
  const amount = Number(returnsNative) / 10 ** decimals;
  if (!Number.isFinite(amount) || !Number.isFinite(price)) {
    return notAvailable('reconciliation-failed');
  }
  return ok({ usd: amount * price, native: { amount, symbol } });
}

/**
 * sUSDS earnings from vaults.fyi, mainnet-only. Total and monthly parse
 * independently — a broken payload on one never sinks the other.
 *
 * Monthly reconciliation: the beta endpoint echoes the resolved period. A
 * resolved start EARLIER than our window start would fold pre-month earnings
 * into "this month" — degrade. Later is fine (position younger than the
 * month). The resolved end is NOT gated against window.endSec: endSec is
 * "now" at window computation and the fetch resolves moments later.
 */
export function computeSavingsEarnings({
  totalReturns,
  partialReturns,
  window
}: SavingsEarningsInput): SavingsEarnings {
  const totalEarned = figureFromReturns(totalReturns);

  const earnedThisMonth: Maybe<EarningsFigure> = (() => {
    const { fromTimestamp, toTimestamp } = partialReturns;
    if (
      typeof fromTimestamp !== 'number' ||
      typeof toTimestamp !== 'number' ||
      fromTimestamp > toTimestamp ||
      fromTimestamp < window.startSec
    ) {
      return notAvailable('reconciliation-failed');
    }
    return figureFromReturns(partialReturns);
  })();

  return { totalEarned, earnedThisMonth };
}

/**
 * stUSDS is not listed on vaults.fyi yet: its protocol entry is always present
 * with both figures as the announced gap, so the UI explains rather than errs.
 * Once listed (flag flip + vaultId), this is replaced by a real fetch+compute.
 */
export function stUsdsPlaceholderEarnings(): SavingsEarnings {
  return {
    totalEarned: notAvailable('stusds-not-listed'),
    earnedThisMonth: notAvailable('stusds-not-listed')
  };
}
