import type { RewardContract } from '../rewards/rewards';
import type { RewardsChartInfoParsed } from '../rewards/useRewardsChartInfo';
import { buildRewardsProduct } from './earnProducts';
import type { EndedRewardPosition } from './types';

/** One entry of a `useReadContracts` result — only the `result` is read here. */
type BalanceRead = { result?: unknown } | undefined;

/**
 * The "Requires action" side of the rewards reads: which DEPRECATED farms the
 * wallet still has a balance in, described by the same registry descriptor a
 * live farm row uses, with the farm's TVL from its BA Labs series.
 *
 * Pure so it can be unit-tested away from the marketplace's fork-backed
 * suite. `balances` is indexed like `allContracts` (one balanceOf read per
 * farm, live and deprecated alike); `charts` like `deprecatedContracts` (the
 * latest-row series, fetched for every deprecated farm up front rather than
 * for the held ones, so it runs beside the balance read instead of behind it).
 */
export function deriveEndedRewardPositions({
  allContracts,
  deprecatedContracts,
  balances,
  charts,
  familyChainIds
}: {
  allContracts: RewardContract[];
  deprecatedContracts: RewardContract[];
  balances: BalanceRead[] | undefined;
  charts: RewardsChartInfoParsed[][] | undefined;
  familyChainIds: number[];
}): EndedRewardPosition[] {
  if (!balances) return [];
  return deprecatedContracts.flatMap((contract, deprecatedIndex) => {
    const balance = balances[allContracts.indexOf(contract)]?.result;
    if (typeof balance !== 'bigint' || balance <= 0n) return [];
    const latest = charts?.[deprecatedIndex]?.[0];
    const tvl = latest ? parseFloat(latest.totalSupplied) : NaN;
    return [
      {
        product: buildRewardsProduct(contract, familyChainIds),
        contract,
        balance,
        ...(Number.isFinite(tvl) ? { tvlUsds: tvl } : {})
      }
    ];
  });
}
