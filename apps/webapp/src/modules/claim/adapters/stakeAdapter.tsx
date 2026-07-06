import { useMemo } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { erc20Abi, formatUnits, type Call } from 'viem';
import {
  useStakeUrnAddress,
  useStakeRewardContracts,
  useRewardContractsToClaim,
  useStakeSkyAllowance,
  usePrices,
  getWriteContractCall,
  stakeModuleAddress,
  stakeModuleAbi,
  skyAddress,
  ZERO_ADDRESS
} from '@/hooks';
import { formatBigInt } from '@/utils';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import type {
  ClaimAdapter,
  ClaimCallOptions,
  ClaimableResult,
  ClaimCallsResult,
  ClaimableReward,
  ClaimScope
} from '../types';

const SOURCE_LABEL = 'Staking';
// Stake reward tokens (SKY / SPK / USDS) are all 18-decimal; the claim read exposes
// no decimals, so format against this shared unit.
const REWARD_DECIMALS = 18;
const ID_SEP = ':';

/** Per-urn identity: `${urnIndex}:${rewardContract}` — carries the urn through `selected`. */
function makeStakeId(urnIndex: bigint, rewardContract: string): string {
  return `${urnIndex}${ID_SEP}${rewardContract.toLowerCase()}`;
}

function parseStakeId(id: string): { urnIndex: bigint; rewardContract: `0x${string}` } {
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
function useStakeUrnRewards(index: bigint | undefined): { rewards: UrnReward[]; isLoading: boolean } {
  const chainId = useChainId();
  const { data: urnAddress } = useStakeUrnAddress(index ?? 0n);
  const { data: stakeRewardContracts } = useStakeRewardContracts();

  const rewardContractAddresses = useMemo(
    () => stakeRewardContracts?.map(({ contractAddress }) => contractAddress) ?? [],
    [stakeRewardContracts]
  );

  const { data, isLoading } = useRewardContractsToClaim({
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
  return { rewards, isLoading };
}

function useStakeClaimable(scope: ClaimScope): ClaimableResult {
  const chainId = useChainId();
  const index = scope.kind === 'stake' ? scope.index : undefined;
  const { rewards, isLoading } = useStakeUrnRewards(index);
  const { data: prices } = usePrices();

  return useMemo(() => {
    if (index === undefined) return { rewards: [], isLoading: false };

    const mapped: ClaimableReward[] = rewards.map(({ contractAddress, claimBalance, rewardSymbol }) => {
      const price = prices?.[rewardSymbol]?.price;
      const amountUsd = price
        ? parseFloat(formatUnits(claimBalance, REWARD_DECIMALS)) * parseFloat(price)
        : 0;
      return {
        id: makeStakeId(index, contractAddress),
        source: 'stake',
        sourceLabel: SOURCE_LABEL,
        tokenSymbol: rewardSymbol,
        icon: (
          <TokenIcon token={{ symbol: rewardSymbol }} width={32} showChainIcon={false} className="h-8 w-8" />
        ),
        formattedAmount: formatBigInt(claimBalance, { unit: REWARD_DECIMALS, maxDecimals: 2 }),
        amountUsd,
        chainId
      };
    });

    return { rewards: mapped, isLoading };
  }, [index, rewards, prices, chainId, isLoading]);
}

function useStakeClaimCalls(selected: ClaimableReward[], options?: ClaimCallOptions): ClaimCallsResult {
  const chainId = useChainId();
  const { address } = useConnection();
  const restake = options?.restake ?? false;

  const stakeSelected = useMemo(() => selected.filter(reward => reward.source === 'stake'), [selected]);
  // Every stake selection in one launch belongs to the same urn (the scope is one urn),
  // so the index is carried by any selected id.
  const index = stakeSelected.length > 0 ? parseStakeId(stakeSelected[0].id).urnIndex : undefined;

  // Only needed to resolve the SKY reward's claim amount for restake, but must be
  // called unconditionally; disabled (empty) when there's no stake selection.
  const { rewards: urnRewards } = useStakeUrnRewards(index);
  const { data: skyAllowance } = useStakeSkyAllowance();

  return useMemo(() => {
    const stakeModule = stakeModuleAddress[chainId as keyof typeof stakeModuleAddress];
    if (!address || index === undefined || stakeSelected.length === 0 || !stakeModule) {
      return { calls: [], prepared: false };
    }

    const selectedContracts = stakeSelected.map(reward => parseStakeId(reward.id).rewardContract);
    const selectedSet = new Set(selectedContracts.map(contract => contract.toLowerCase()));

    // Restake (SKY-only): the selected SKY reward folds back via `lock`. lock pulls SKY
    // from the owner, so prepend an approve when the current allowance is short.
    const skyReward = restake
      ? urnRewards.find(
          reward =>
            reward.rewardSymbol.toUpperCase() === 'SKY' &&
            selectedSet.has(reward.contractAddress.toLowerCase())
        )
      : undefined;
    const restakeAmount = skyReward?.claimBalance ?? 0n;
    const sky = skyAddress[chainId as keyof typeof skyAddress];

    const calls: Call[] = [];

    if (
      restake &&
      restakeAmount > 0n &&
      sky &&
      (skyAllowance === undefined || skyAllowance < restakeAmount)
    ) {
      calls.push(
        getWriteContractCall({
          to: sky,
          abi: erc20Abi,
          functionName: 'approve',
          args: [stakeModule, restakeAmount]
        })
      );
    }

    // One getReward(owner, urnIndex, rewardContract, owner) per selected contract — all
    // before `lock`, so the SKY reward lands with the owner before being re-locked.
    for (const rewardContract of selectedContracts) {
      calls.push(
        getWriteContractCall({
          to: stakeModule,
          abi: stakeModuleAbi,
          functionName: 'getReward',
          args: [address, index, rewardContract, address]
        })
      );
    }

    if (restake && restakeAmount > 0n) {
      calls.push(
        getWriteContractCall({
          to: stakeModule,
          abi: stakeModuleAbi,
          functionName: 'lock',
          args: [address, index, restakeAmount, 0]
        })
      );
    }

    return { calls, prepared: calls.length > 0 };
  }, [address, index, stakeSelected, urnRewards, restake, skyAllowance, chainId]);
}

/**
 * Stake claim adapter (SKY Staking Engine `stakeModule`, per-urn). `useClaimable`
 * ({kind:'stake',index}) reads a single urn's claimable rewards and normalizes each
 * into a `ClaimableReward` keyed `${urnIndex}:${rewardContract}`. `useClaimCalls`
 * builds a `getReward(owner,urnIndex,rewardContract,owner)` Call per selected contract;
 * with `restake` it also folds the selected SKY reward back via `lock` (+ a conditional
 * SKY approve). The panel merges these into one `useTransactionFlow`. Only the stake
 * scope yields rewards; a portfolio claim-all across every urn is a later concern
 * (would need urn enumeration). Mainnet-only.
 */
export const stakeAdapter: ClaimAdapter = {
  source: 'stake',
  useClaimable: useStakeClaimable,
  useClaimCalls: useStakeClaimCalls
};
