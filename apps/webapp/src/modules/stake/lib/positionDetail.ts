import { formatUnits } from 'viem';
import {
  lsSkySkyRewardAddress,
  lsSkySpkRewardAddress,
  lsSkyUsdsRewardAddress,
  TransactionTypeEnum
} from '@/hooks';
import type { StakeHistory } from '@/hooks/stake/stakeModule';

/** Known staking-engine reward contracts → reward token symbol, per chain. */
export function rewardContractSymbols(chainId: number): Record<string, string> {
  const map: Record<string, string> = {};
  const entries: [Record<number, `0x${string}`>, string][] = [
    [lsSkyUsdsRewardAddress as Record<number, `0x${string}`>, 'USDS'],
    [lsSkySpkRewardAddress as Record<number, `0x${string}`>, 'SPK'],
    [lsSkySkyRewardAddress as Record<number, `0x${string}`>, 'SKY']
  ];
  for (const [addresses, symbol] of entries) {
    const address = addresses[chainId];
    if (address) map[address.toLowerCase()] = symbol;
  }
  return map;
}

/**
 * USD value of already-claimed reward events in a stake history slice. Claimed
 * amounts are valued through the known reward-contract → token map; unknown
 * contracts are skipped rather than mispriced. (Shared by the F3 summary card
 * and the F5 position-details modal — same convention, different scopes.)
 */
export function calculateClaimedRewardsUsd(
  history: StakeHistory | undefined,
  chainId: number,
  priceOf: (symbol: string) => number
): number {
  const symbols = rewardContractSymbols(chainId);
  return (history ?? [])
    .filter(item => item.type === TransactionTypeEnum.STAKE_REWARD)
    .reduce((total, item) => {
      const contract = 'rewardContract' in item ? String(item.rewardContract).toLowerCase() : undefined;
      const amount = 'amount' in item ? (item.amount as bigint) : 0n;
      const symbol = contract ? symbols[contract] : undefined;
      if (!symbol) return total;
      return total + Number(formatUnits(amount, 18)) * priceOf(symbol);
    }, 0);
}

/**
 * The warning-sentence percentage (M14): how far the collateral price can fall
 * before liquidation — the complement of the vault's liquidation proximity, so
 * the sentence and the risk meter can never disagree. Null while loading.
 */
export function liquidationDropPercent(liquidationProximityPercentage: number | undefined): number | null {
  if (liquidationProximityPercentage === undefined) return null;
  return Math.min(100, Math.max(0, 100 - liquidationProximityPercentage));
}

/**
 * The C.2 "has borrow history" predicate: whether the urn EVER drew debt,
 * from its subgraph history slice. Drives the inactive modal's borrow block
 * and the Reopen CTA's borrow-expanded pre-configuration — an emptied urn
 * that only ever staked gets the staked-only variant.
 */
export function hasStakeBorrowHistory(history: StakeHistory | undefined): boolean {
  return (history ?? []).some(item => item.type === TransactionTypeEnum.STAKE_BORROW);
}
