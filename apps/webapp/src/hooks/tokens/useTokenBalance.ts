import { useBalance, useConfig, useReadContracts } from 'wagmi';
import { erc20Abi, formatUnits } from 'viem';
import {
  type ReadContractsErrorType,
  type GetBalanceErrorType,
  getBalance,
  Config,
  multicall
} from '@wagmi/core';
import { useQuery } from '@tanstack/react-query';

type UseTokenBalanceParameters = {
  address?: `0x${string}`;
  token?: `0x${string}`;
  chainId: number;
  isNative?: boolean;
  enabled?: boolean;
};

export type TokenItem = {
  address?: `0x${string}`;
  isNative?: boolean;
  symbol: string;
};

type ChainTokenMap = {
  [chainId: number]: TokenItem[];
};

type UseTokenBalancesParameters = {
  address?: `0x${string}`;
  enabled?: boolean;
} & (
  | {
      tokens: TokenItem[];
      chainId?: number;
      chainTokenMap?: never;
    }
  | {
      chainTokenMap: ChainTokenMap;
      tokens?: never;
      chainId?: never;
    }
);

export type TokenBalance = {
  value: bigint;
  decimals: number;
  formatted: string;
  symbol?: string;
  chainId: number;
};

type TokenBalanceRequiredSymbol = {
  value: bigint;
  decimals: number;
  formatted: string;
  symbol: string;
  chainId: number;
};

type UseTokenBalanceReturnType = {
  data?: TokenBalance;
  refetch: () => void;
  isLoading: boolean;
  error: GetBalanceErrorType | ReadContractsErrorType | null;
};

type UseTokenBalancesReturnType = {
  data?: TokenBalanceRequiredSymbol[];
  refetch: () => void;
  isLoading: boolean;
  error: GetBalanceErrorType | ReadContractsErrorType | null;
};

export function useTokenBalance({
  address,
  token,
  isNative = false,
  chainId,
  enabled = true
}: UseTokenBalanceParameters): UseTokenBalanceReturnType {
  const {
    data: tokenResultData,
    refetch: refetchTokenResult,
    isLoading: isTokenResultLoading,
    error: tokenResultError
  } = useReadContracts({
    contracts: [
      {
        address: token,
        abi: erc20Abi,
        chainId,
        functionName: 'balanceOf',
        args: address ? [address] : undefined
      },
      {
        address: token,
        abi: erc20Abi,
        chainId,
        functionName: 'decimals'
      }
    ],
    allowFailure: false,
    query: {
      enabled: enabled && !!address && !!token && !isNative
    }
  });

  const {
    data: nativeResultData,
    refetch: refetchNativeResult,
    isLoading: isNativeResultLoading,
    error: nativeResultError
  } = useBalance({
    address,
    chainId,
    query: { enabled: enabled && isNative }
  });

  return {
    data:
      isNative && nativeResultData && chainId
        ? {
            ...nativeResultData,
            chainId,
            formatted: formatUnits(nativeResultData.value, nativeResultData.decimals)
          }
        : tokenResultData && chainId
          ? {
              value: tokenResultData[0],
              decimals: tokenResultData[1],
              formatted: formatUnits(tokenResultData[0], tokenResultData[1]),
              chainId
            }
          : undefined,
    refetch: isNative ? refetchNativeResult : refetchTokenResult,
    isLoading: isNativeResultLoading || isTokenResultLoading,
    error: nativeResultError || tokenResultError
  };
}

// Fetcher function that handles both ERC20 and native tokens
async function fetchTokenBalances({
  config,
  address,
  tokenMap
}: {
  config: Config;
  address: `0x${string}`;
  tokenMap: ChainTokenMap;
}): Promise<TokenBalanceRequiredSymbol[]> {
  // Process all chains in parallel
  const chainPromises = Object.entries(tokenMap).map(async ([chainId, tokens]) => {
    const numericChainId = Number(chainId);
    const nonNativeTokens = tokens.filter(token => !token.isNative);
    const nativeToken = tokens.find(token => token.isNative);
    const results: TokenBalanceRequiredSymbol[] = [];

    // Create promises for both native and ERC20 token fetching
    const promises: Promise<void>[] = [];

    // Fetch native token balance
    if (nativeToken) {
      const nativePromise = getBalance(config, {
        address,
        chainId: numericChainId
      })
        .then(balance => {
          results.push({
            value: balance.value,
            decimals: 18, // Native tokens always have 18 decimals
            formatted: formatUnits(balance.value, 18),
            symbol: nativeToken.symbol,
            chainId: numericChainId
          });
        })
        .catch(error => {
          console.error(`Failed to fetch native balance for chain ${numericChainId}:`, error);
        });

      promises.push(nativePromise);
    }

    // Fetch ERC20 token balances
    if (nonNativeTokens.length > 0) {
      const erc20Promise = (async () => {
        try {
          // Batch all ERC20 calls for this chain
          const contracts = nonNativeTokens.flatMap(token => [
            {
              address: token.address!,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [address]
            },
            {
              address: token.address!,
              abi: erc20Abi,
              functionName: 'decimals'
            }
          ]);

          const multicallResults = await multicall(config, {
            contracts,
            chainId: numericChainId
          });

          // Process results
          for (let i = 0; i < multicallResults.length; i += 2) {
            const tokenIndex = i / 2;
            const token = nonNativeTokens[tokenIndex];
            const balance = multicallResults[i].result as bigint;
            const decimals = multicallResults[i + 1].result as number;

            if (balance !== undefined && decimals !== undefined) {
              results.push({
                value: balance,
                decimals,
                formatted: formatUnits(balance, decimals),
                symbol: token.symbol,
                chainId: numericChainId
              });
            }
          }
        } catch (error) {
          console.error(`Failed to fetch ERC20 balances for chain ${numericChainId}:`, error);
        }
      })();

      promises.push(erc20Promise);
    }

    // Wait for both native and ERC20 operations to complete
    await Promise.all(promises);
    return results;
  });

  // Wait for all chains to complete and flatten the results
  const allResults = await Promise.all(chainPromises);
  return allResults.flat();
}

//takes in either a chainTokenMap, or a tokens array and chainId
export function useTokenBalances({
  address,
  tokens,
  chainId,
  chainTokenMap,
  enabled = true
}: UseTokenBalancesParameters): UseTokenBalancesReturnType {
  const config = useConfig();

  // Convert legacy params to chainTokenMap format
  const tokenMap = chainTokenMap ?? (tokens && chainId ? { [chainId]: tokens } : {});

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['token-balances', address, tokenMap],
    queryFn: () => fetchTokenBalances({ config, address: address!, tokenMap }),
    enabled: enabled && !!address && Object.keys(tokenMap).length > 0
  });

  return {
    data,
    isLoading,
    error: error as GetBalanceErrorType | ReadContractsErrorType | null,
    refetch
  };
}
