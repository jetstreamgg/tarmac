import { useBalance, useReadContracts } from 'wagmi';
import { erc20Abi, formatUnits } from 'viem';
import type { ReadContractsErrorType, GetBalanceErrorType } from '@wagmi/core';

type UseTokenBalanceParameters = {
  address?: `0x${string}`;
  token?: `0x${string}`;
  chainId?: number;
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
        ? { ...nativeResultData, chainId }
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

export function useTokenBalances({
  address,
  tokens,
  chainId,
  chainTokenMap,
  enabled = true
}: UseTokenBalancesParameters): UseTokenBalancesReturnType {
  // Convert legacy params to chainTokenMap format
  const tokenMap = chainTokenMap ?? (tokens && chainId ? { [chainId]: tokens } : {});

  // Aggregate results from all chains
  const results = Object.entries(tokenMap).map(([chainId, tokens]) => {
    const pair = {
      chainId: Number(chainId),
      tokens
    };

    const nonNativeTokens = pair.tokens.filter(tokenItem => !tokenItem.isNative);
    const nativeToken = pair.tokens.find(tokenItem => tokenItem.isNative) || null;

    const {
      data: tokenResultData,
      refetch: refetchTokenResult,
      isLoading: isTokenResultLoading,
      error: tokenResultError
    } = useReadContracts({
      contracts: nonNativeTokens
        .map(tokenItem => [
          {
            address: tokenItem.address,
            abi: erc20Abi,
            chainId: pair.chainId,
            functionName: 'balanceOf',
            args: address ? [address] : undefined
          },
          {
            address: tokenItem.address,
            abi: erc20Abi,
            chainId: pair.chainId,
            functionName: 'decimals'
          }
        ])
        .flat(),
      allowFailure: false,
      query: {
        enabled: enabled && !!address && nonNativeTokens.length > 0
      }
    });

    const {
      data: nativeResultData,
      refetch: refetchNativeResult,
      isLoading: isNativeResultLoading,
      error: nativeResultError
    } = useBalance({
      address,
      chainId: pair.chainId,
      query: { enabled: enabled && !!nativeToken }
    });

    const formattedTokenResultData = tokenResultData?.reduce<TokenBalance[]>((acc, _, index, array) => {
      if (index % 2 === 0) {
        const tokenIndex = index / 2;
        const tokenItem = nonNativeTokens[tokenIndex];
        acc.push({
          value: array[index] as bigint,
          decimals: array[index + 1] as number,
          formatted: formatUnits(tokenResultData[index] as bigint, tokenResultData[index + 1] as number),
          symbol: tokenItem.symbol,
          chainId: pair.chainId
        });
      }
      return acc;
    }, []);

    const nativeResultWithSymbol =
      nativeToken && nativeResultData
        ? {
            ...nativeResultData,
            symbol: nativeToken.symbol,
            chainId: pair.chainId
          }
        : null;

    return {
      data:
        formattedTokenResultData || nativeResultWithSymbol
          ? ([
              ...(formattedTokenResultData || []),
              ...(nativeResultWithSymbol ? [nativeResultWithSymbol] : [])
            ] as TokenBalanceRequiredSymbol[])
          : undefined,
      isLoading: isNativeResultLoading || isTokenResultLoading,
      error: nativeResultError || tokenResultError,
      refetch: async () => {
        await Promise.all([refetchTokenResult(), refetchNativeResult()]);
      }
    };
  });

  return {
    data: results.every(r => r.data) ? results.flatMap(r => r.data!) : undefined,
    isLoading: results.some(r => r.isLoading),
    error: results.find(r => r.error)?.error ?? null,
    refetch: async () => {
      await Promise.all(results.map(r => r.refetch()));
    }
  };
}
