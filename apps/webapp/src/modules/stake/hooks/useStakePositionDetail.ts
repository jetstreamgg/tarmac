import { useCallback, useMemo } from 'react';
import { formatUnits } from 'viem';
import { useChainId } from 'wagmi';
import {
  getIlkName,
  useCollateralData,
  useHighestRateFromChartData,
  useMultipleRewardsChartInfo,
  usePrices,
  useRewardContractTokens,
  useSkyPrice,
  useStakeHistory,
  useStakeUrnAddress,
  useStakeUrnSelectedRewardContract,
  useStakeUrnSelectedVoteDelegate,
  useVault,
  Vault,
  ZERO_ADDRESS
} from '@/hooks';
import { calculateClaimedRewardsUsd, hasStakeBorrowHistory } from '../lib/positionDetail';
import { useStakeUrnClaimables } from './useStakeUrnClaimables';

export interface StakePositionDetail {
  urnAddress: `0x${string}` | undefined;
  vault: Vault | undefined;
  vaultLoading: boolean;
  hasDebt: boolean;
  /** Emptied urn (C13): the vault loaded with zero collateral. Urns are never deleted. */
  isInactive: boolean;
  /** Whether the urn EVER drew debt (C14, subgraph) — the inactive borrow block + reopen shape. */
  hasBorrowHistory: boolean;
  /** The urn's current reward contract / vote delegate (ZERO_ADDRESS = none). */
  rewardContract: `0x${string}` | undefined;
  rewardSymbol: string | undefined;
  voteDelegate: `0x${string}` | undefined;
  /** Live staking-reward rate of the urn's farm, as a decimal (0.0569 = 5.69%). */
  rewardsRate: number | null;
  /** skyLocked × rate, in SKY (18 dec) — F4's 1e9-scaled math (M22). */
  estAnnualRewardsSky: bigint | null;
  claimableUsd: number;
  claimableSymbols: string[];
  /** Raw claimable balance of the urn's farm (single-farm sum) — the menu chip. */
  claimableTokenAmount: bigint;
  claimableLoading: boolean;
  /** Claimed (subgraph history) + still claimable, in USD. */
  rewardsEarnedUsd: number;
  /** True while either leg of rewardsEarnedUsd (history or claimables) is still loading. */
  rewardsEarnedLoading: boolean;
  stabilityFee: bigint | undefined;
  skyPriceUsd: number | null;
  stakedUsd: number | null;
  borrowedUsd: number;
}

/**
 * Everything both F5 surfaces read about one urn (details modal left panel,
 * manage-sheet position summary): live vault state, the urn's current
 * reward/delegate selections, reward valuations, and rates. Read-only
 * composition over existing hooks — no engine hook is touched.
 */
export function useStakePositionDetail(urnIndex: number): StakePositionDetail {
  const chainId = useChainId();
  const ilkName = getIlkName(2);

  const { data: urnAddress } = useStakeUrnAddress(BigInt(urnIndex));
  const { data: vault, isLoading: vaultLoading } = useVault(urnAddress || ZERO_ADDRESS, ilkName);
  const { data: collateralData } = useCollateralData(ilkName);

  const { data: rewardContract } = useStakeUrnSelectedRewardContract({ urn: urnAddress || ZERO_ADDRESS });
  const { data: voteDelegate } = useStakeUrnSelectedVoteDelegate({ urn: urnAddress || ZERO_ADDRESS });
  const { data: rewardContractTokens } = useRewardContractTokens(
    rewardContract && rewardContract !== ZERO_ADDRESS ? rewardContract : undefined
  );

  const { data: rewardsChartInfo } = useMultipleRewardsChartInfo({
    rewardContractAddresses: rewardContract && rewardContract !== ZERO_ADDRESS ? [rewardContract] : []
  });
  const highestRateData = useHighestRateFromChartData(rewardsChartInfo ?? []);
  const parsedRate = highestRateData ? parseFloat(highestRateData.rate) : NaN;
  const rewardsRate = Number.isFinite(parsedRate) ? parsedRate : null;

  const skyLocked = vault?.collateralAmount ?? 0n;
  const estAnnualRewardsSky =
    rewardsRate !== null && skyLocked > 0n
      ? (skyLocked * BigInt(Math.round(rewardsRate * 1_000_000_000))) / 1_000_000_000n
      : null;

  // Claimable rewards for THIS urn across ALL stake reward contracts — the
  // legacy PositionDetail read (C12): residual claimables from a previous farm
  // must surface here and in the claim modal alike. SKY-first order.
  const { claimables, isLoading: claimableLoading } = useStakeUrnClaimables(BigInt(urnIndex));
  const { data: prices } = usePrices();
  const priceOf = useCallback((symbol: string) => parseFloat(prices?.[symbol]?.price ?? '0'), [prices]);
  const claimableUsd = claimables.reduce(
    (total, reward) => total + Number(formatUnits(reward.claimBalance, 18)) * priceOf(reward.rewardSymbol),
    0
  );
  const claimableSymbols =
    claimables.length > 0 ? [...new Set(claimables.map(reward => reward.rewardSymbol))] : ['SKY'];
  const claimableTokenAmount = claimables.reduce((total, reward) => total + reward.claimBalance, 0n);

  // Rewards earned = claimed events of THIS urn + still claimable (F3 convention,
  // urn-scoped through the subgraph index filter).
  const { data: urnHistory, isLoading: historyLoading } = useStakeHistory({ index: urnIndex });
  const claimedUsd = useMemo(
    () => calculateClaimedRewardsUsd(urnHistory, chainId, priceOf),
    [urnHistory, chainId, priceOf]
  );
  const rewardsEarnedUsd = claimedUsd + claimableUsd;

  const { priceString: skyPriceString } = useSkyPrice();
  const skyPriceUsd = skyPriceString ? parseFloat(skyPriceString) : null;
  const stakedUsd = skyPriceUsd !== null ? Number(formatUnits(skyLocked, 18)) * skyPriceUsd : null;
  // USDS at parity — the module-wide convention.
  const borrowedUsd = Number(formatUnits(vault?.debtValue ?? 0n, 18));

  return {
    urnAddress,
    vault,
    vaultLoading,
    hasDebt: (vault?.debtValue ?? 0n) > 0n,
    isInactive: !!urnAddress && !vaultLoading && vault !== undefined && (vault.collateralAmount ?? 0n) === 0n,
    hasBorrowHistory: hasStakeBorrowHistory(urnHistory),
    rewardContract,
    rewardSymbol: rewardContractTokens?.rewardsToken?.symbol,
    voteDelegate,
    rewardsRate,
    estAnnualRewardsSky,
    claimableUsd,
    claimableSymbols,
    claimableTokenAmount,
    claimableLoading,
    rewardsEarnedUsd,
    rewardsEarnedLoading: historyLoading || claimableLoading,
    stabilityFee: collateralData?.stabilityFee,
    skyPriceUsd,
    stakedUsd,
    borrowedUsd
  };
}
