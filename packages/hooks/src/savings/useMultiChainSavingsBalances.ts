import { useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useTokenBalance } from '../tokens/useTokenBalance';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { DataSource, ReadHook } from '../hooks';
import { getEtherscanLink } from '@jetstreamgg/utils';
import { useReadSavingsUsds, sUsdsAddress } from './useReadSavingsUsds';
import { TOKENS } from '../tokens/tokens.constants';
import { usePreviewSwapExactIn } from '../psm/usePreviewSwapExactIn';
import { isMainnetId, isBaseChainId, isArbitrumChainId } from '@jetstreamgg/utils';

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
  const arbitrumChainId = chainIds?.find(chainId => isArbitrumChainId(chainId));

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
    chainId: baseChainId as number,
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

  const convertedBaseBalance = usePreviewSwapExactIn(
    baseSusdsBalance?.value || 0n,
    TOKENS.susds,
    TOKENS.usds,
    baseChainId
  );

  //ARBITRUM - get balance of sUSDS
  const {
    data: arbitrumSusdsBalance,
    isLoading: arbitrumSusdsBalanceIsLoading,
    error: arbitrumSusdsBalanceError,
    refetch: refetchArbitrumSusdsBalance
  } = useTokenBalance({
    chainId: arbitrumChainId as number,
    address: acct,
    token: TOKENS.susds.address[arbitrumChainId as keyof typeof TOKENS.susds.address],
    enabled: !!acct && !!arbitrumChainId
  });

  const dataSourcesArbitrum: DataSource = {
    title: 'sUSDS Token Balance',
    onChain: true,
    href: getEtherscanLink(
      arbitrumChainId || 1,
      TOKENS.susds.address[arbitrumChainId as keyof typeof TOKENS.susds.address],
      'address'
    ),
    trustLevel: TRUST_LEVELS[TrustLevelEnum.ZERO]
  };

  const convertedArbitrumBalance = usePreviewSwapExactIn(
    arbitrumSusdsBalance?.value || 0n,
    TOKENS.susds,
    TOKENS.usds,
    arbitrumChainId
  );

  // Hook common interface
  const isLoading = useMemo(() => {
    return maxWithdrawIsLoading || baseSusdsBalanceIsLoading || arbitrumSusdsBalanceIsLoading;
  }, [maxWithdrawIsLoading, baseSusdsBalanceIsLoading, arbitrumSusdsBalanceIsLoading]);

  const error = useMemo(() => {
    return maxWithdrawError || baseSusdsBalanceError || arbitrumSusdsBalanceError;
  }, [maxWithdrawError, baseSusdsBalanceError, arbitrumSusdsBalanceError]);

  const mutate = () => {
    refetchMaxWithdraw();
    refetchBaseSusdsBalance();
    refetchArbitrumSusdsBalance();
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

    // Add arbitrum balance
    if (arbitrumChainId) {
      balances[arbitrumChainId] = convertedArbitrumBalance.value || 0n;
    }

    return balances;
  }, [
    maxWithdraw,
    convertedBaseBalance.value,
    convertedArbitrumBalance.value,
    ethereumChainId,
    baseChainId,
    arbitrumChainId
  ]);

  return {
    isLoading,
    data,
    error,
    mutate,
    dataSources: [dataSourcesMaxWithdraw, dataSourcesBase, dataSourcesArbitrum]
  };
}
