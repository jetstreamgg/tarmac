import { useMemo } from 'react';
import { useReadContracts } from 'wagmi';
import { ReadHook } from '../hooks';
import { usdsSkyRewardAbi } from '../generated';
import { erc20Abi } from 'viem';

export type UseRewardContractsToClaimResponse = ReadHook & {
  data:
    | {
        contractAddress: `0x${string}`;
        claimBalance: bigint;
        rewardSymbol: string;
      }[]
    | undefined;
};

/**
 * Fetches claimable rewards for multiple addresses across multiple reward contracts.
 * Returns aggregated rewards - if multiple addresses have rewards from the same contract,
 * they are summed together into a single entry per contract.
 */
export const useRewardContractsToClaim = ({
  rewardContractAddresses,
  addresses, // single address or array of addresses
  chainId,
  enabled = true
}: {
  rewardContractAddresses: `0x${string}`[];
  addresses?: `0x${string}` | `0x${string}`[];
  chainId: number;
  enabled?: boolean;
}): UseRewardContractsToClaimResponse => {
  const addressArray = Array.isArray(addresses) ? addresses : addresses ? [addresses] : [];
  // Fetch earned balances and reward tokens for all address/contract combinations
  const {
    data: earnedAndTokenData,
    isLoading: isEarnedLoading,
    error: earnedError,
    refetch
  } = useReadContracts({
    contracts: addressArray.flatMap(addr =>
      rewardContractAddresses.flatMap(contractAddress => [
        {
          address: contractAddress,
          abi: usdsSkyRewardAbi,
          chainId,
          functionName: 'earned',
          args: [addr]
        },
        {
          address: contractAddress,
          abi: usdsSkyRewardAbi,
          chainId,
          functionName: 'rewardsToken'
        }
      ])
    ),
    allowFailure: false,
    query: {
      enabled: enabled && addressArray.length > 0 && rewardContractAddresses.length > 0
    }
  });

  // Parse the results to get contracts with balances > 0 (memoized to prevent re-renders)
  const contractsWithBalances = useMemo(() => {
    if (!earnedAndTokenData) return [];

    const results: Array<{
      contractAddress: `0x${string}`;
      earned: bigint;
      tokenAddress: `0x${string}`;
    }> = [];

    let dataIndex = 0;
    for (let addressIndex = 0; addressIndex < addressArray.length; addressIndex++) {
      for (const contractAddress of rewardContractAddresses) {
        const earned = earnedAndTokenData[dataIndex] as bigint;
        const tokenAddress = earnedAndTokenData[dataIndex + 1] as `0x${string}`;

        if (earned && earned > 0n) {
          results.push({
            contractAddress,
            earned,
            tokenAddress
          });
        }

        dataIndex += 2; // Skip to next pair (earned, rewardsToken)
      }
    }

    return results;
  }, [earnedAndTokenData, addressArray.length, rewardContractAddresses]);

  // Fetch token symbols for reward tokens that have balances
  const {
    data: tokenSymbols,
    isLoading: isSymbolsLoading,
    error: symbolsError
  } = useReadContracts({
    contracts: contractsWithBalances.map(item => ({
      address: item!.tokenAddress,
      abi: erc20Abi,
      chainId,
      functionName: 'symbol'
    })),
    allowFailure: false,
    query: {
      enabled: contractsWithBalances.length > 0
    }
  });

  // Combine all data into the final format (memoized to prevent re-renders)
  const data = useMemo(() => {
    if (contractsWithBalances.length === 0 || !tokenSymbols) return undefined;

    return contractsWithBalances.map((item, index) => ({
      contractAddress: item!.contractAddress,
      claimBalance: item!.earned,
      rewardSymbol: tokenSymbols[index] as string
    }));
  }, [contractsWithBalances, tokenSymbols]);

  return {
    data,
    isLoading: isEarnedLoading || isSymbolsLoading,
    error: earnedError || symbolsError,
    mutate: refetch,
    dataSources: []
  };
};
