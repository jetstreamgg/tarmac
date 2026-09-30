import type { RewardFarmClaim } from '../../../hooks/rewards/rewardFarmEarnedClient';
import { dayIsoOf, priceAtOrBefore } from './historicPrice';
import { notAvailable, ok, type EarningsFigure, type EarningsWindow, type Maybe } from './types';

type RewardToken = { symbol: string; decimals: number };

type RewardFarmTotalInput = {
  /** This farm's claims only. */
  claims: RewardFarmClaim[];
  /** Unclaimed `earned()` now, reward token base units. */
  earnedNow: bigint;
  /** Daily USD price series of the reward token ('YYYY-MM-DD' → price). */
  historicPrices: Map<string, number>;
  currentPrice: number;
  token: RewardToken;
};

type RewardFarmMonthInput = RewardFarmTotalInput & {
  /** Unclaimed `earned()` at the end of the block before `monthStartBlock`. */
  earnedAtMonthStart: bigint;
  /** First block at or after the window start. */
  monthStartBlock: bigint;
  window: EarningsWindow;
};

const units = (value: bigint, decimals: number): number => Number(value) / 10 ** decimals;

/** Σ claim × price on its claim day; undefined when a claim day has no price at or before it. */
function claimsUsd(claims: RewardFarmClaim[], prices: Map<string, number>, decimals: number) {
  let usd = 0;
  for (const claim of claims) {
    const price = priceAtOrBefore(prices, dayIsoOf(claim.blockTimestamp));
    if (price === undefined) return undefined;
    usd += units(claim.amount, decimals) * price;
  }
  return usd;
}

const sumAmounts = (claims: RewardFarmClaim[]): bigint => claims.reduce((acc, c) => acc + c.amount, 0n);

/**
 * Lifetime rewards from one Sky Token Rewards farm: every claim valued at
 * the price of its claim day plus the unclaimed balance at the current price
 * (the Merkl valuation rule). A claim day without a price degrades the figure
 * instead of guessing.
 */
export function computeRewardFarmTotal({
  claims,
  earnedNow,
  historicPrices,
  currentPrice,
  token
}: RewardFarmTotalInput): Maybe<EarningsFigure> {
  if (claims.length === 0 && earnedNow === 0n) return ok({ usd: 0 });

  const claimedUsd = claimsUsd(claims, historicPrices, token.decimals);
  if (claimedUsd === undefined) return notAvailable('reconciliation-failed');

  return ok({
    usd: claimedUsd + units(earnedNow, token.decimals) * currentPrice,
    native: { amount: units(sumAmounts(claims) + earnedNow, token.decimals), symbol: token.symbol }
  });
}

/**
 * Rewards accrued since the window start: claims from `monthStartBlock` on,
 * plus the unclaimed balance now, minus the unclaimed balance the month began
 * with. The month-start balance is valued at the last price before the window
 * (the previous UTC day), so the figure is exactly the change in the lifetime
 * total over the month; it goes negative when the reward token's price fell
 * more than the month accrued.
 *
 * Claims are split by block, not timestamp, so the claim cut and the
 * month-start `earned()` read describe the same chain state. A negative token
 * accrual means the claims and the balances disagree (e.g. the indexer has not
 * caught up with a fresh claim) and degrades the figure.
 */
export function computeRewardFarmMonth({
  claims,
  earnedNow,
  earnedAtMonthStart,
  monthStartBlock,
  window,
  historicPrices,
  currentPrice,
  token
}: RewardFarmMonthInput): Maybe<EarningsFigure> {
  const monthClaims = claims.filter(c => BigInt(c.blockNumber) >= monthStartBlock);
  const accrued = sumAmounts(monthClaims) + earnedNow - earnedAtMonthStart;
  if (accrued < 0n) return notAvailable('reconciliation-failed');
  if (monthClaims.length === 0 && earnedNow === 0n && earnedAtMonthStart === 0n) return ok({ usd: 0 });

  const claimedUsd = claimsUsd(monthClaims, historicPrices, token.decimals);
  const startPrice =
    earnedAtMonthStart === 0n ? 0 : priceAtOrBefore(historicPrices, dayIsoOf(window.startSec - 1));
  if (claimedUsd === undefined || startPrice === undefined) return notAvailable('reconciliation-failed');

  return ok({
    usd:
      claimedUsd +
      units(earnedNow, token.decimals) * currentPrice -
      units(earnedAtMonthStart, token.decimals) * startPrice,
    native: { amount: units(accrued, token.decimals), symbol: token.symbol }
  });
}
