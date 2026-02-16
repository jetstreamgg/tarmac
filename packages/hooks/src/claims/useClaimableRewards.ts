import { useMemo } from 'react';
import { useChainId, useConnection, useReadContracts } from 'wagmi';
import { erc20Abi, formatUnits } from 'viem';
import { isTestnetId, chainId as chainIdConstants } from '@jetstreamgg/sky-utils';
import { ClaimableReward, UseClaimableRewardsResponse } from './claims';
import { useAvailableTokenRewardContracts } from '../rewards/useAvailableTokenRewardContracts';
import { useRewardContractsToClaim } from '../rewards/useRewardContractsToClaim';
import { useAllStakeUrnAddresses } from '../stake/useAllStakeUrnAddresses';
import { useStakeRewardContracts } from '../stake/useStakeRewardContracts';
import { useMorphoVaultAllRewards } from '../morpho/useMorphoVaultAllRewards';
import { getWriteContractCall } from '../shared/getWriteContractCall';
import {
  usdsSkyRewardAbi,
  stakeModuleAbi,
  stakeModuleAddress,
  morphoMerklDistributorAddress,
  morphoMerklDistributorImplementationAbi
} from '../generated';
import { usePrices } from '../prices/usePrices';
import { getTokenDecimals } from '../tokens/tokens.constants';

/**
 * Aggregation hook that fetches claimable rewards from all modules
 * (Rewards, Staking Engine, Morpho Vaults) and produces a unified
 * ClaimableReward[] array with pre-built Call objects.
 */
export function useClaimableRewards(): UseClaimableRewardsResponse {
  const currentChainId = useChainId();
  const { address } = useConnection();
  const { data: pricesData, isLoading: pricesLoading } = usePrices();

  const mainnetChainId = isTestnetId(currentChainId) ? chainIdConstants.tenderly : chainIdConstants.mainnet;

  // ============================================================
  // REWARDS MODULE
  // ============================================================
  const rewardContracts = useAvailableTokenRewardContracts(mainnetChainId);
  const {
    data: rewardContractsToClaim,
    isLoading: rewardsLoading,
    error: rewardsError
  } = useRewardContractsToClaim({
    rewardContractAddresses:
      rewardContracts?.map(({ contractAddress }) => contractAddress as `0x${string}`) || [],
    addresses: address,
    chainId: mainnetChainId,
    enabled: !!rewardContracts?.length && !!address
  });

  const rewardsItems: ClaimableReward[] = useMemo(() => {
    if (!rewardContractsToClaim || !address) return [];

    return rewardContractsToClaim.map(({ contractAddress, claimBalance, rewardSymbol }) => {
      const rewardContract = rewardContracts.find(
        rc => (rc.contractAddress as string).toLowerCase() === contractAddress.toLowerCase()
      );
      const decimals = rewardContract?.rewardToken
        ? getTokenDecimals(rewardContract.rewardToken, mainnetChainId)
        : 18;
      const price = pricesData?.[rewardSymbol]?.price;
      const usdValue = price ? parseFloat(formatUnits(claimBalance, decimals)) * parseFloat(price) : 0;

      return {
        id: `rewards-${contractAddress.toLowerCase()}`,
        module: 'Rewards' as const,
        rewardTokenSymbol: rewardSymbol,
        rewardTokenDecimals: decimals,
        claimableAmount: claimBalance,
        claimableAmountUsd: usdValue,
        call: getWriteContractCall({
          to: contractAddress,
          abi: usdsSkyRewardAbi,
          functionName: 'getReward',
          args: []
        })
      };
    });
  }, [rewardContractsToClaim, rewardContracts, address, mainnetChainId, pricesData]);

  // ============================================================
  // STAKING ENGINE MODULE (all URNs)
  // ============================================================
  const { data: urnAddresses, isLoading: urnsLoading } = useAllStakeUrnAddresses(address);
  const { data: stakeRewardContracts, isLoading: stakeContractsLoading } = useStakeRewardContracts();

  // Single multicall to read earned(urnAddress) + rewardsToken() for each
  // stakeRewardContract x urnAddress combination
  const stakeEarnedContracts = useMemo(() => {
    if (!urnAddresses?.length || !stakeRewardContracts?.length) return [];

    return urnAddresses.flatMap(urnAddr =>
      stakeRewardContracts.flatMap(({ contractAddress }) => [
        {
          address: contractAddress,
          abi: usdsSkyRewardAbi,
          chainId: mainnetChainId,
          functionName: 'earned' as const,
          args: [urnAddr]
        },
        {
          address: contractAddress,
          abi: usdsSkyRewardAbi,
          chainId: mainnetChainId,
          functionName: 'rewardsToken' as const
        }
      ])
    );
  }, [urnAddresses, stakeRewardContracts, mainnetChainId]);

  const {
    data: stakeEarnedData,
    isLoading: stakeEarnedLoading,
    error: stakeEarnedError
  } = useReadContracts({
    contracts: stakeEarnedContracts,
    allowFailure: true,
    query: {
      enabled: stakeEarnedContracts.length > 0
    }
  });

  // Parse results grouped by URN index
  const stakeContractsWithBalances = useMemo(() => {
    if (!stakeEarnedData || !urnAddresses?.length || !stakeRewardContracts?.length) return [];

    const results: Array<{
      urnIndex: number;
      contractAddress: `0x${string}`;
      earned: bigint;
      tokenAddress: `0x${string}`;
    }> = [];

    let dataIndex = 0;
    for (let urnIdx = 0; urnIdx < urnAddresses.length; urnIdx++) {
      for (const { contractAddress } of stakeRewardContracts) {
        const earnedResult = stakeEarnedData[dataIndex];
        const tokenResult = stakeEarnedData[dataIndex + 1];

        const earned = earnedResult?.status === 'success' ? (earnedResult.result as bigint) : 0n;
        const tokenAddress =
          tokenResult?.status === 'success' ? (tokenResult.result as `0x${string}`) : undefined;

        if (earned > 0n && tokenAddress) {
          results.push({
            urnIndex: urnIdx,
            contractAddress: contractAddress as `0x${string}`,
            earned,
            tokenAddress
          });
        }

        dataIndex += 2;
      }
    }

    return results;
  }, [stakeEarnedData, urnAddresses, stakeRewardContracts]);

  // Fetch token symbols for stake reward tokens with non-zero balances
  const { data: stakeTokenSymbols, isLoading: stakeSymbolsLoading } = useReadContracts({
    contracts: stakeContractsWithBalances.map(item => ({
      address: item.tokenAddress,
      abi: erc20Abi,
      chainId: mainnetChainId,
      functionName: 'symbol' as const
    })),
    allowFailure: false,
    query: {
      enabled: stakeContractsWithBalances.length > 0
    }
  });

  const stakeItems: ClaimableReward[] = useMemo(() => {
    if (!stakeContractsWithBalances.length || !stakeTokenSymbols || !address) return [];

    const stakeAddr = stakeModuleAddress[mainnetChainId as keyof typeof stakeModuleAddress];
    if (!stakeAddr) return [];

    return stakeContractsWithBalances.map((item, index) => {
      const symbol = stakeTokenSymbols[index] as string;
      const decimals = 18;
      const price = pricesData?.[symbol]?.price;
      const usdValue = price ? parseFloat(formatUnits(item.earned, decimals)) * parseFloat(price) : 0;

      return {
        id: `stake-${item.urnIndex}-${item.contractAddress.toLowerCase()}`,
        module: 'Staking Engine' as const,
        moduleDetail: `URN #${item.urnIndex}`,
        rewardTokenSymbol: symbol,
        rewardTokenDecimals: decimals,
        claimableAmount: item.earned,
        claimableAmountUsd: usdValue,
        call: getWriteContractCall({
          to: stakeAddr,
          abi: stakeModuleAbi,
          functionName: 'getReward',
          args: [address, BigInt(item.urnIndex), item.contractAddress, address]
        })
      };
    });
  }, [stakeContractsWithBalances, stakeTokenSymbols, address, mainnetChainId, pricesData]);

  // ============================================================
  // MORPHO VAULTS MODULE (single API call for all vaults)
  // ============================================================
  const { data: morphoAllRewards, isLoading: morphoLoading, error: morphoError } = useMorphoVaultAllRewards();

  const morphoItems: ClaimableReward[] = useMemo(() => {
    if (!address || !morphoAllRewards.length) return [];

    const merklAddr =
      morphoMerklDistributorAddress[mainnetChainId as keyof typeof morphoMerklDistributorAddress];
    if (!merklAddr) return [];

    return morphoAllRewards
      .map(({ vaultConfig, vaultAddress, rewardsData }) => {
        const claimableRewards = rewardsData.rewards.filter(r => r.amount > 0n && r.proofs.length > 0);
        if (claimableRewards.length === 0) return null;

        const users = claimableRewards.map(() => address);
        const tokens = claimableRewards.map(r => r.tokenAddress);
        const amounts = claimableRewards.map(r => r.amount);
        const proofs = claimableRewards.map(r => r.proofs as `0x${string}`[]);

        const totalUsd = claimableRewards.reduce((sum, r) => sum + r.amountUsd, 0);
        const primaryReward = claimableRewards[0];
        const tokenSymbol =
          claimableRewards.length === 1
            ? primaryReward.tokenSymbol
            : `${primaryReward.tokenSymbol} + ${claimableRewards.length - 1} more`;

        return {
          id: `morpho-${vaultAddress.toLowerCase()}`,
          module: 'Morpho Vault' as const,
          moduleDetail: vaultConfig.name,
          rewardTokenSymbol: tokenSymbol,
          rewardTokenDecimals: primaryReward.tokenDecimals,
          claimableAmount: primaryReward.amount,
          claimableAmountUsd: totalUsd,
          call: getWriteContractCall({
            to: merklAddr,
            abi: morphoMerklDistributorImplementationAbi,
            functionName: 'claim',
            args: [users, tokens, amounts, proofs]
          })
        };
      })
      .filter(Boolean) as ClaimableReward[];
  }, [address, mainnetChainId, morphoAllRewards]);

  // ============================================================
  // COMBINE ALL
  // ============================================================
  const data = useMemo(
    () => [...rewardsItems, ...stakeItems, ...morphoItems],
    [rewardsItems, stakeItems, morphoItems]
  );

  const isLoading =
    pricesLoading ||
    rewardsLoading ||
    urnsLoading ||
    stakeContractsLoading ||
    stakeEarnedLoading ||
    stakeSymbolsLoading ||
    morphoLoading;

  const error = rewardsError || stakeEarnedError || morphoError;

  return {
    data,
    isLoading,
    error: error as Error | null,
    mutate: () => {},
    dataSources: []
  };
}
