import { useReadContracts } from 'wagmi';
import { ReadHook } from '../hooks';
import { usdsSkyRewardAbi } from '../generated';
import { ZERO_ADDRESS } from '../constants';
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

export const useRewardContractsToClaim = ({
  rewardContractAddresses,
  userAddress,
  chainId,
  enabled = true
}: {
  rewardContractAddresses: `0x${string}`[];
  userAddress?: `0x${string}`;
  chainId: number;
  enabled?: boolean;
}): UseRewardContractsToClaimResponse => {
  // Fetch earned balances and reward tokens for all contracts
  const {
    data: earnedAndTokenData,
    isLoading: isEarnedLoading,
    error: earnedError,
    refetch
  } = useReadContracts({
    contracts: rewardContractAddresses.flatMap(contractAddress => [
      {
        address: contractAddress,
        abi: usdsSkyRewardAbi,
        chainId,
        functionName: 'earned',
        args: [userAddress || ZERO_ADDRESS]
      },
      {
        address: contractAddress,
        abi: usdsSkyRewardAbi,
        chainId,
        functionName: 'rewardsToken'
      }
    ]),
    allowFailure: false,
    query: {
      enabled: enabled && !!userAddress && userAddress !== ZERO_ADDRESS && rewardContractAddresses.length > 0
    }
  });

  // Parse the results to get contracts with balances > 0
  const contractsWithBalances = earnedAndTokenData
    ? rewardContractAddresses
        .map((contractAddress, i) => {
          const earned = earnedAndTokenData[i * 2] as bigint;
          const tokenAddress = earnedAndTokenData[i * 2 + 1] as `0x${string}`;

          if (earned && earned > 0n) {
            return {
              contractAddress,
              earned,
              tokenAddress
            };
          }
          return null;
        })
        .filter(Boolean)
    : [];

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

  // Combine all data into the final format
  const data =
    contractsWithBalances.length > 0 && tokenSymbols
      ? contractsWithBalances.map((item, index) => ({
          contractAddress: item!.contractAddress,
          claimBalance: item!.earned,
          rewardSymbol: tokenSymbols[index] as string
        }))
      : undefined;

  return {
    data,
    isLoading: isEarnedLoading || isSymbolsLoading,
    error: earnedError || symbolsError,
    mutate: refetch,
    dataSources: []
  };
};
