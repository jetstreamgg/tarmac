import type { MerklClaimRaw, MerklUserRewardRaw } from '../../../hooks/morpho/merklEarnedClient';
import { notAvailable, ok, type EarningsFigure, type Maybe, type TokenAmount } from './types';

/** Named Merkl campaigns attributed to the Flagship product without a vault address in `reason`. */
export const MERKL_AIRDROP_REASONS: readonly string[] = ['usds-flagship-ssr'];

/** A breakdown `reason` counts as Flagship-attributed when it carries the vault address or a known campaign name. */
export const isFlagshipAttributedReason = (reason: string, flagshipVaultAddress: string): boolean =>
  reason.toLowerCase().includes(flagshipVaultAddress.toLowerCase()) || MERKL_AIRDROP_REASONS.includes(reason);

/**
 * Lowercased addresses of the reward tokens with at least one attributed
 * breakdown — the tokens whose historic price series the valuation needs.
 * Exported for the aggregator hook's dependent price query.
 */
export function attributedRewardTokenAddresses(
  rewards: MerklUserRewardRaw[],
  flagshipVaultAddress: string
): string[] {
  const addresses = new Set<string>();
  for (const reward of rewards) {
    if (reward.breakdowns.some(b => isFlagshipAttributedReason(b.reason, flagshipVaultAddress))) {
      addresses.add(reward.token.address.toLowerCase());
    }
  }
  return [...addresses].sort();
}

export type MerklEarningsInput = {
  rewards: MerklUserRewardRaw[];
  claims: MerklClaimRaw[];
  /** Daily USD price per reward token: lowercased address → ('YYYY-MM-DD' → price). */
  historicPricesByToken: Map<string, Map<string, number>>;
  flagshipVaultAddress: string;
};

export type MerklEarnings = {
  totalEarned: Maybe<EarningsFigure>;
  earnedThisMonth: Maybe<EarningsFigure>;
};

const units = (value: bigint, decimals: number): number => Number(value) / 10 ** decimals;

const dayIsoOf = (timestampSec: number): string => new Date(timestampSec * 1000).toISOString().slice(0, 10);

/** Price on the day, else the nearest previous day in the series (ISO strings sort chronologically). */
function priceAtOrBefore(prices: Map<string, number>, dayIso: string): number | undefined {
  const exact = prices.get(dayIso);
  if (exact !== undefined) return exact;
  let bestDay: string | undefined;
  for (const day of prices.keys()) {
    if (day <= dayIso && (bestDay === undefined || day > bestDay)) bestDay = day;
  }
  return bestDay === undefined ? undefined : prices.get(bestDay);
}

/**
 * Flagship-attributed Merkl rewards. Earned = amount + pending over the
 * attributed breakdowns (Merkl amounts are lifetime-cumulative, so fully
 * claimed campaigns still count). USD values each claim at the price of its
 * claim day and the unclaimed remainder at the current token price. Two gates
 * degrade the figure instead of guessing: claim events must sum exactly to the
 * reward's claimed amount (wei), and every claim day needs a price at or
 * before it. Merkl has no per-window data, so a wallet with attributed rewards
 * always reports the month as the announced 'merkl-monthly-unsupported' gap.
 */
export function computeMerklEarnings({
  rewards,
  claims,
  historicPricesByToken,
  flagshipVaultAddress
}: MerklEarningsInput): MerklEarnings {
  const isAttributed = (reason: string): boolean => isFlagshipAttributedReason(reason, flagshipVaultAddress);

  const tokens: TokenAmount[] = [];
  let usd = 0;

  for (const reward of rewards) {
    const attributed = reward.breakdowns.filter(b => isAttributed(b.reason));
    if (attributed.length === 0) continue;

    const { address, symbol, decimals, price: currentPrice } = reward.token;
    let earnedWei = 0n;
    let claimedWei = 0n;
    for (const b of attributed) {
      earnedWei += BigInt(b.amount) + BigInt(b.pending);
      claimedWei += BigInt(b.claimed);
    }

    const attributedClaims = claims.filter(
      c => c.token.toLowerCase() === address.toLowerCase() && isAttributed(c.reason)
    );
    const claimsWei = attributedClaims.reduce((acc, c) => acc + BigInt(c.amount), 0n);
    if (claimsWei !== claimedWei) {
      return {
        totalEarned: notAvailable('reconciliation-failed'),
        earnedThisMonth: notAvailable('merkl-monthly-unsupported')
      };
    }

    const prices = historicPricesByToken.get(address.toLowerCase()) ?? new Map<string, number>();
    for (const c of attributedClaims) {
      const price = priceAtOrBefore(prices, dayIsoOf(c.timestamp));
      if (price === undefined) {
        return {
          totalEarned: notAvailable('reconciliation-failed'),
          earnedThisMonth: notAvailable('merkl-monthly-unsupported')
        };
      }
      usd += units(BigInt(c.amount), decimals) * price;
    }

    usd += units(earnedWei - claimedWei, decimals) * currentPrice;
    tokens.push({ amount: units(earnedWei, decimals), symbol });
  }

  // Never earned attributed Merkl rewards → genuinely zero, month included.
  if (tokens.length === 0) {
    return { totalEarned: ok({ usd: 0 }), earnedThisMonth: ok({ usd: 0 }) };
  }

  const figure: EarningsFigure = tokens.length === 1 ? { usd, native: tokens[0] } : { usd, byToken: tokens };
  return { totalEarned: ok(figure), earnedThisMonth: notAvailable('merkl-monthly-unsupported') };
}
