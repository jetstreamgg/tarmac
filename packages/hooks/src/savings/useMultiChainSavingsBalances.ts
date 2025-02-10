import { useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useTokenBalance } from '../tokens/useTokenBalance';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { DataSource, ReadHook } from '../hooks';
import { getEtherscanLink } from '@jetstreamgg/utils';
import { useReadSavingsUsds, sUsdsAddress } from './useReadSavingsUsds';
import { TOKENS } from '../tokens/tokens.constants';
import { usePreviewSwapExactIn } from '../psm/usePreviewSwapExactIn';
import { isMainnetId, isBaseChainId } from '@jetstreamgg/utils';

export type MultiChainSavingsBalancesHook = ReadHook & {
  data?: Record<number, bigint>;
};

export function useMultiChainSavingsBalances({
  chainIds,
  address
}: {
  chainIds?: number[];
  address?: `0x${string}`;
}): MultiChainSavingsBalancesHook {
  const ethereumChainId = chainIds?.find(chainId => isMainnetId(chainId));
  const baseChainId = chainIds?.find(chainId => isBaseChainId(chainId));
  //TODO: handle arbitrum chains

  const { address: connectedAddress } = useAccount();
  const acct = address || connectedAddress;

  // ETHEREUM - get balance via maxWithdraw
  // maxWithdraw calls 'convertToAssets' under the hood to calculate the balance with earnings
  const {
    data: maxWithdraw,
    isLoading: maxWithdrawIsLoading,
    error: maxWithdrawError,
    refetch: refetchMaxWithdraw
  } = useReadSavingsUsds({
    functionName: 'maxWithdraw',
    args: [acct as `0x${string}`],
    chainId: ethereumChainId as keyof typeof sUsdsAddress,
    query: {
      enabled: !!acct && !!ethereumChainId
    }
  });
  const dataSourcesMaxWithdraw: DataSource = {
    title: 'SAVINGSDAI Contract. maxWithdraw',
    onChain: true,
    href: getEtherscanLink(
      ethereumChainId || 1,
      sUsdsAddress[ethereumChainId as keyof typeof sUsdsAddress],
      'address'
    ),
    trustLevel: TRUST_LEVELS[TrustLevelEnum.ZERO]
  };
  //BASE - get balance of sUSDS
  const {
    data: baseSusdsBalance,
    isLoading: baseSusdsBalanceIsLoading,
    error: baseSusdsBalanceError,
    refetch: refetchBaseSusdsBalance
  } = useTokenBalance({
    chainId: baseChainId,
    address: acct,
    token: TOKENS.susds.address[baseChainId as keyof typeof TOKENS.susds.address],
    enabled: !!acct && !!baseChainId
  });

  const dataSourcesBase: DataSource = {
    title: 'sUSDS Token Balance',
    onChain: true,
    href: getEtherscanLink(
      baseChainId || 1,
      TOKENS.susds.address[baseChainId as keyof typeof TOKENS.susds.address],
      'address'
    ),
    trustLevel: TRUST_LEVELS[TrustLevelEnum.ZERO]
  };

  //TODO: get arbitrum balance and convert it

  const convertedBaseBalance = usePreviewSwapExactIn(
    baseSusdsBalance?.value || 0n,
    TOKENS.susds,
    TOKENS.usds,
    baseChainId
  );

  // Hook common interface
  const isLoading = useMemo(() => {
    return maxWithdrawIsLoading || baseSusdsBalanceIsLoading;
  }, [maxWithdrawIsLoading, baseSusdsBalanceIsLoading]);

  const error = useMemo(() => {
    return maxWithdrawError || baseSusdsBalanceError;
  }, [maxWithdrawError, baseSusdsBalanceError]);

  const mutate = () => {
    refetchMaxWithdraw();
    refetchBaseSusdsBalance();
  };

  const data = useMemo<Record<number, bigint> | undefined>(() => {
    const balances: Record<number, bigint> = {};

    // Add Ethereum balance
    if (ethereumChainId) {
      balances[ethereumChainId] = maxWithdraw || 0n;
    }

    // Add base balance
    if (baseChainId) {
      balances[baseChainId] = convertedBaseBalance.value || 0n;
    }

    //TODO: add arbitrum balance

    return balances;
  }, [maxWithdraw, convertedBaseBalance.value, ethereumChainId, baseChainId]);

  return {
    isLoading,
    data,
    error,
    mutate,
    dataSources: [dataSourcesMaxWithdraw, dataSourcesBase]
  };
}
