import { useMemo } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { formatUnits, type Call } from 'viem';
import {
  useStakeUrnAddress,
  useStakeRewardContracts,
  useRewardContractsToClaim,
  usePrices,
  getWriteContractCall,
  stakeModuleAddress,
  stakeModuleAbi,
  ZERO_ADDRESS
} from '@/hooks';
import { formatBigInt } from '@/utils';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { rewardTokenName } from '../tokenNames';
import type { ClaimAdapter, ClaimableResult, ClaimCallsResult, ClaimableReward, ClaimScope } from '../types';

// Stake reward tokens (SKY / SPK / USDS) are all 18-decimal; the claim read exposes
// no decimals, so format against this shared unit.
const REWARD_DECIMALS = 18;
const ID_SEP = ':';

/** Per-urn identity: `${urnIndex}:${rewardContract}` — carries the urn through `selected`. */
export function makeStakeId(urnIndex: bigint, rewardContract: string): string {
  return `${urnIndex}${ID_SEP}${rewardContract.toLowerCase()}`;
}

export function parseStakeId(id: string): { urnIndex: bigint; rewardContract: `0x${string}` } {
  const separator = id.indexOf(ID_SEP);
  return {
    urnIndex: BigInt(id.slice(0, separator)),
    rewardContract: id.slice(separator + 1) as `0x${string}`
  };
}

type UrnReward = { contractAddress: `0x${string}`; claimBalance: bigint; rewardSymbol: string };

/**
 * Shared read: resolves the urn address for `index` and reads its claimable rewards
 * per stake reward contract. Both adapter hooks call this (react-query dedupes the
 * underlying reads); it is disabled — and returns nothing — when `index` is absent.
 */
function useStakeUrnRewards(index: bigint | undefined): {
  rewards: UrnReward[];
  isLoading: boolean;
  refresh: () => void;
} {
  const chainId = useChainId();
  const { data: urnAddress } = useStakeUrnAddress(index ?? 0n);
  const { data: stakeRewardContracts } = useStakeRewardContracts();

  const rewardContractAddresses = useMemo(
    () => stakeRewardContracts?.map(({ contractAddress }) => contractAddress) ?? [],
    [stakeRewardContracts]
  );

  const { data, isLoading, mutate } = useRewardContractsToClaim({
    rewardContractAddresses,
    addresses: urnAddress,
    chainId,
    enabled:
      index !== undefined && rewardContractAddresses.length > 0 && !!urnAddress && urnAddress !== ZERO_ADDRESS
  });

  // Referentially stable while `data` is unchanged (incl. the disabled/undefined
  // case) — a fresh `[]` here would bust useStakeClaimable's memo every render
  // and, through the panel's merged-rewards chain, loop its modal-content sync.
  const rewards = useMemo(() => (data as UrnReward[] | undefined) ?? [], [data]);
  return { rewards, isLoading, refresh: mutate };
}

function useStakeClaimable(scope: ClaimScope): ClaimableResult {
  const chainId = useChainId();
  const index = scope.kind === 'stake' ? scope.index : undefined;
  const { rewards, isLoading, refresh } = useStakeUrnRewards(index);
  const { data: prices, isLoading: pricesLoading } = usePrices();

  return useMemo(() => {
    if (index === undefined) return { rewards: [], isLoading: false, refresh };

    const mapped: ClaimableReward[] = rewards.map(({ contractAddress, claimBalance, rewardSymbol }) => {
      const price = prices?.[rewardSymbol]?.price;
      const amountUsd = price
        ? parseFloat(formatUnits(claimBalance, REWARD_DECIMALS)) * parseFloat(price)
        : 0;
      return {
        id: makeStakeId(index, contractAddress),
        source: 'stake',
        tokenSymbol: rewardSymbol,
        tokenName: rewardTokenName(rewardSymbol),
        icon: (
          <TokenIcon token={{ symbol: rewardSymbol }} width={32} showChainIcon={false} className="h-8 w-8" />
        ),
        // The claim-modal comps pin two decimals on the hero amounts ("22.90",
        // Figma 1036:213986).
        formattedAmount: formatBigInt(claimBalance, {
          unit: REWARD_DECIMALS,
          minDecimals: 2,
          maxDecimals: 2
        }),
        amount: parseFloat(formatUnits(claimBalance, REWARD_DECIMALS)),
        amountUsd,
        chainId
      };
    });

    // Prices count as loading: a claim valued at $0.00 off the missing feed
    // reads as worthless, not pending.
    return { rewards: mapped, isLoading: isLoading || pricesLoading, refresh };
  }, [index, rewards, prices, chainId, isLoading, pricesLoading, refresh]);
}

function useStakeClaimCalls(selected: ClaimableReward[]): ClaimCallsResult {
  const chainId = useChainId();
  const { address } = useConnection();

  const stakeSelected = useMemo(() => selected.filter(reward => reward.source === 'stake'), [selected]);

  return useMemo(() => {
    const stakeModule = stakeModuleAddress[chainId as keyof typeof stakeModuleAddress];
    if (!address || stakeSelected.length === 0 || !stakeModule) {
      return { calls: [], prepared: false };
    }

    // One getReward(owner, urnIndex, rewardContract, owner) per selected (urn, contract).
    const calls: Call[] = stakeSelected.map(reward => {
      const { urnIndex, rewardContract } = parseStakeId(reward.id);
      return getWriteContractCall({
        to: stakeModule,
        abi: stakeModuleAbi,
        functionName: 'getReward',
        args: [address, urnIndex, rewardContract, address]
      });
    });

    return { calls, prepared: calls.length > 0 };
  }, [address, stakeSelected, chainId]);
}

/**
 * Stake claim adapter (SKY Staking Engine `stakeModule`, per-urn). `useClaimable`
 * ({kind:'stake',index}) reads a single urn's claimable rewards and normalizes each
 * into a `ClaimableReward` keyed `${urnIndex}:${rewardContract}`. `useClaimCalls`
 * builds a `getReward(owner,urnIndex,rewardContract,owner)` Call per selected id (the
 * selection may span urns). Restake lives in the stake page's own claim flow
 * (`useStakeClaimLaunch`), not here. Only the stake
 * scope yields rewards; a portfolio claim-all across every urn is a later concern
 * (would need urn enumeration). Mainnet-only.
 */
export const stakeAdapter: ClaimAdapter = {
  source: 'stake',
  useClaimable: useStakeClaimable,
  useClaimCalls: useStakeClaimCalls
};
