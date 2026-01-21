import { useMemo } from 'react';
import { useConnection, useChainId } from 'wagmi';
import { useTokenBalance } from '../tokens/useTokenBalance';
import { mcdPotAddress, usdsAddress, usdsL2Address } from '../generated';
import { useReadMcdPot } from '../generated';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { DataSource, ReadHook } from '../hooks';
import { getEtherscanLink, isL2ChainId } from '@jetstreamgg/sky-utils';
import { calculateDsrInfo } from './calculateDsrInfo';
import { useReadSavingsUsds, sUsdsAddress } from './useReadSavingsUsds';
import { TOKENS } from '../tokens/tokens.constants';
import { usePreviewSwapExactIn } from '../psm/usePreviewSwapExactIn';

export type SavingsHookData = {
  savingsTvl: bigint;
  savingsRate: bigint;
  userSavingsBalance: bigint;
  userNstBalance: bigint;
};

export type DsrHook = ReadHook & {
  data?: SavingsHookData;
};

export function useSavingsData(address?: `0x${string}`): DsrHook {
  const connectedChainId = useChainId();
  // If the connected chain is base, use mainnet instead (except for getting the sUSDS and NST balance)
  const ethereumChainId = !isL2ChainId(connectedChainId) ? connectedChainId : 1;

  const { address: connectedAddress } = useConnection();
  const acct = address || connectedAddress;

  const {
    data: chi,
    isLoading: chiIsLoading,
    error: chiError,
    refetch: refetchChi
  } = useReadMcdPot({ functionName: 'chi', chainId: ethereumChainId as keyof typeof useReadMcdPot });

  const dataSourcesChi: DataSource = {
    title: 'MCD_POT Contract. chi',
    onChain: true,
    href: getEtherscanLink(
      ethereumChainId,
      mcdPotAddress[ethereumChainId as keyof typeof mcdPotAddress],
      'address'
    ),
    trustLevel: TRUST_LEVELS[TrustLevelEnum.ZERO]
  };

  const {
    data: Pie,
    isLoading: PieIsLoading,
    error: PieError,
    refetch: refetchPie
  } = useReadMcdPot({ functionName: 'Pie', chainId: ethereumChainId as keyof typeof useReadMcdPot });

  const dataSourcesPie: DataSource = {
    title: 'MCD_POT Contract. Pie',
    onChain: true,
    href: getEtherscanLink(
      ethereumChainId,
      mcdPotAddress[ethereumChainId as keyof typeof mcdPotAddress],
      'address'
    ),
    trustLevel: TRUST_LEVELS[TrustLevelEnum.ZERO]
  };

  const {
    data: dsr,
    isLoading: dsrIsLoading,
    error: dsrError,
    refetch: refetchDsr
  } = useReadMcdPot({ functionName: 'dsr', chainId: ethereumChainId as keyof typeof useReadMcdPot });

  const dataSourcesDsr = {
    title: 'MCD_POT Contract. dsr',
    onChain: true,
    href: getEtherscanLink(
      ethereumChainId,
      mcdPotAddress[ethereumChainId as keyof typeof mcdPotAddress],
      'address'
    ),
    trustLevel: TRUST_LEVELS[TrustLevelEnum.ZERO]
  };

  const {
    data: pie,
    error: pieError,
    isLoading: pieIsLoading,
    refetch: refetchSmallPie
  } = useReadMcdPot({
    functionName: 'pie',
    args: [acct || '0x123'],
    chainId: ethereumChainId as keyof typeof useReadMcdPot,
    query: {
      enabled: !!acct
    }
  });
  const dataSourcesSmallPie: DataSource = {
    title: 'MCD_POT Contract. pie',
    onChain: true,
    href: getEtherscanLink(
      ethereumChainId,
      mcdPotAddress[ethereumChainId as keyof typeof mcdPotAddress],
      'address'
    ),
    trustLevel: TRUST_LEVELS[TrustLevelEnum.ZERO]
  };

  const {
    data: userNstBalance,
    error: userNstBalanceError,
    isLoading: userNstBalanceIsLoading,
    refetch: refetchUserNstBalance
  } = useTokenBalance({
    address: acct,
    chainId: connectedChainId,
    token: isL2ChainId(connectedChainId)
      ? usdsL2Address[connectedChainId as keyof typeof usdsL2Address]
      : usdsAddress[connectedChainId as keyof typeof usdsAddress]
  });
  // TODO add data source

  // ETHEREUM ONLY - get balance via maxWithdraw
  // maxWithdraw calls 'convertToAssets' under the hood to calculate the balance with earnings
  const {
    data: maxWithdraw,
    isLoading: maxWithdrawIsLoading,
    error: maxWithdrawError,
    refetch: refetchMaxWithdraw
  } = useReadSavingsUsds({
    functionName: 'maxWithdraw',
    args: [acct || '0x123'],
    chainId: ethereumChainId as keyof typeof useReadSavingsUsds,
    query: {
      enabled: !!acct && !isL2ChainId(connectedChainId)
    }
  });
  const dataSourcesMaxWithdraw: DataSource = {
    title: 'SAVINGSDAI Contract. maxWithdraw',
    onChain: true,
    href: getEtherscanLink(
      ethereumChainId,
      sUsdsAddress[ethereumChainId as keyof typeof sUsdsAddress],
      'address'
    ),
    trustLevel: TRUST_LEVELS[TrustLevelEnum.ZERO]
  };

  //BASE ONLY - get balance of sUSDS
  const {
    data: sUsdsBalance,
    isLoading: sUsdsBalanceIsLoading,
    error: sUsdsBalanceError,
    refetch: refetchSUsdsBalance
  } = useTokenBalance({
    address: acct,
    token: TOKENS.susds.address[connectedChainId],
    chainId: connectedChainId,
    enabled: !!acct && isL2ChainId(connectedChainId)
  });

  const convertedBalance = usePreviewSwapExactIn(sUsdsBalance?.value || 0n, TOKENS.susds, TOKENS.usds);

  // Hook common interface
  const isLoading = useMemo(() => {
    return (
      chiIsLoading ||
      PieIsLoading ||
      dsrIsLoading ||
      pieIsLoading ||
      userNstBalanceIsLoading ||
      maxWithdrawIsLoading ||
      sUsdsBalanceIsLoading
    );
  }, [
    chiIsLoading,
    PieIsLoading,
    dsrIsLoading,
    pieIsLoading,
    userNstBalanceIsLoading,
    maxWithdrawIsLoading,
    sUsdsBalanceIsLoading
  ]);

  const error = useMemo(() => {
    return (
      chiError ||
      pieError ||
      PieError ||
      dsrError ||
      userNstBalanceError ||
      maxWithdrawError ||
      sUsdsBalanceError
    );
  }, [chiError, pieError, PieError, dsrError, userNstBalanceError, maxWithdrawError, sUsdsBalanceError]);

  const mutate = () => {
    refetchChi();
    refetchDsr();
    refetchPie();
    refetchSmallPie();
    refetchUserNstBalance();
    refetchMaxWithdraw();
    refetchSUsdsBalance();
  };

  const data = useMemo<SavingsHookData | undefined>(() => {
    // We need to assert the balances below are not 0n or we'll get stuck loading
    if ((!Pie && Pie !== 0n) || (!dsr && dsr !== 0n) || (!chi && chi !== 0n)) {
      return undefined;
    }

    // calculate balance of single user
    const { savingsRate, savingsTvl } = calculateDsrInfo({ dsr, pie: pie || 0n, chi, Pie });

    return {
      savingsRate,
      savingsTvl,
      userSavingsBalance: isL2ChainId(connectedChainId) ? convertedBalance.value : maxWithdraw || 0n,
      userNstBalance: userNstBalance?.value || 0n
    };
  }, [pie, Pie, dsr, chi, userNstBalance, maxWithdraw, sUsdsBalance]);

  return {
    isLoading,
    data,
    error,
    mutate,
    dataSources: [dataSourcesChi, dataSourcesDsr, dataSourcesPie, dataSourcesSmallPie, dataSourcesMaxWithdraw]
  };
}
