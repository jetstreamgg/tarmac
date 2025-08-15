import { useMemo } from 'react';
import { useAccount, useChainId, useReadContracts, useReadContract } from 'wagmi';
import { useTokenBalance } from '../tokens/useTokenBalance';
import { usdsAddress, stUsdsAddress, stUsdsAbi } from '../generated';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { DataSource, ReadHook } from '../hooks';
import { getEtherscanLink, isTestnetId } from '@jetstreamgg/sky-utils';
import { useCollateralData } from '../vaults/useCollateralData';
import { getIlkName } from '../vaults/helpers';

export type StUsdsHookData = {
  totalAssets: bigint;
  totalSupply: bigint;
  assetPerShare: bigint;
  availableLiquidity: bigint;
  userStUsdsBalance: bigint;
  userUsdsBalance: bigint;
  userSuppliedUsds: bigint;
  userMaxDeposit: bigint;
  userMaxWithdraw: bigint;
  moduleRate: bigint;
  chi: bigint;
  cap: bigint;
  line: bigint;
};

export type StUsdsHook = ReadHook & {
  data?: StUsdsHookData;
};

export function useStUsdsData(address?: `0x${string}`): StUsdsHook {
  const connectedChainId = useChainId();
  const chainId = isTestnetId(connectedChainId) ? 314310 : 1; //StUsds is only on mainnet / mainnet testnet
  const { address: connectedAddress } = useAccount();
  const acct = address || connectedAddress;

  const stUsdsContractAddress = stUsdsAddress[chainId as keyof typeof stUsdsAddress];

  // Get staking engine collateral data for debt calculation
  const stakingEngineIlk = getIlkName(2); // Staking engine is collateral type 2
  const {
    data: stakingEngineData,
    isLoading: isLoadingStakingEngine,
    mutate: refetchStakingEngine
  } = useCollateralData(stakingEngineIlk);

  // Batch all contract reads into a single multicall
  const {
    data: contractData,
    isLoading: isContractLoading,
    error: contractError,
    refetch: mutateContractData
  } = useReadContracts({
    contracts: [
      {
        address: stUsdsContractAddress,
        abi: stUsdsAbi,
        functionName: 'totalAssets',
        chainId
      },
      {
        address: stUsdsContractAddress,
        abi: stUsdsAbi,
        functionName: 'totalSupply',
        chainId
      },
      {
        address: stUsdsContractAddress,
        abi: stUsdsAbi,
        functionName: 'cap',
        chainId
      },
      {
        address: stUsdsContractAddress,
        abi: stUsdsAbi,
        functionName: 'line',
        chainId
      },
      {
        address: stUsdsContractAddress,
        abi: stUsdsAbi,
        functionName: 'ysr',
        chainId
      },
      {
        address: stUsdsContractAddress,
        abi: stUsdsAbi,
        functionName: 'chi',
        chainId
      },
      ...(acct
        ? [
            {
              address: stUsdsContractAddress,
              abi: stUsdsAbi,
              functionName: 'balanceOf',
              args: [acct],
              chainId
            },
            {
              address: stUsdsContractAddress,
              abi: stUsdsAbi,
              functionName: 'maxDeposit',
              args: [acct],
              chainId
            },
            {
              address: stUsdsContractAddress,
              abi: stUsdsAbi,
              functionName: 'maxWithdraw',
              args: [acct],
              chainId
            }
          ]
        : [])
    ]
  });

  // Extract results from multicall
  const totalAssets = contractData?.[0]?.result as bigint | undefined;
  const totalSupply = contractData?.[1]?.result as bigint | undefined;
  const cap = contractData?.[2]?.result as bigint | undefined;
  const line = contractData?.[3]?.result as bigint | undefined;
  const ysr = contractData?.[4]?.result as bigint | undefined;
  const chi = contractData?.[5]?.result as bigint | undefined;
  const userStUsdsBalance = acct ? (contractData?.[6]?.result as bigint | undefined) : undefined;
  const userMaxDeposit = acct ? (contractData?.[7]?.result as bigint | undefined) : undefined;
  const userMaxWithdraw = acct ? (contractData?.[8]?.result as bigint | undefined) : undefined;

  const { data: userConvertedAssets, refetch: mutateConvertToAssets } = useReadContract({
    address: stUsdsContractAddress,
    abi: stUsdsAbi,
    functionName: 'convertToAssets',
    args: userStUsdsBalance ? [userStUsdsBalance] : [0n],
    chainId
  });

  const {
    data: userUsdsBalance,
    isLoading: userUsdsLoading,
    refetch: mutateUserUsdsBalance
  } = useTokenBalance({
    address: acct,
    chainId: chainId,
    token: usdsAddress[chainId as keyof typeof usdsAddress],
    enabled: !!acct
  });

  const assetPerShare = useMemo(() => {
    if (!totalAssets || !totalSupply || totalSupply === 0n) return 0n;
    return (totalAssets * 10n ** 18n) / totalSupply;
  }, [totalAssets, totalSupply]);

  const userSuppliedUsds = useMemo(() => {
    // convertToAssets calculates real-time value including pending yield.
    // Chi (rate accumulator) only updates on deposits/withdrawals, but convertToAssets
    // computes what chi should be now based on time elapsed, giving accurate value
    // without needing on-chain updates.
    if (userConvertedAssets) {
      return userConvertedAssets;
    }
    // Fallback: uses stale totalAssets, won't show pending yield
    if (!userStUsdsBalance || userStUsdsBalance === 0n) return 0n;
    if (totalAssets && totalSupply && totalSupply > 0n) {
      return (userStUsdsBalance * totalAssets) / totalSupply;
    }
    return userStUsdsBalance;
  }, [userConvertedAssets, userStUsdsBalance, totalAssets, totalSupply]);

  // Calculate available liquidity as totalAssets - staking engine total debt
  const availableLiquidity = useMemo(() => {
    const stakingEngineDebt = stakingEngineData?.totalDaiDebt || 0n;
    const assets = totalAssets || 0n;
    return assets > stakingEngineDebt ? assets - stakingEngineDebt : 0n;
  }, [totalAssets, stakingEngineData?.totalDaiDebt]);

  const isLoading = isContractLoading || (!!acct && userUsdsLoading) || isLoadingStakingEngine;

  const data: StUsdsHookData | undefined = useMemo(() => {
    if (!contractData) return undefined;

    return {
      totalAssets: totalAssets || 0n,
      totalSupply: totalSupply || 0n,
      assetPerShare,
      availableLiquidity,
      userStUsdsBalance: userStUsdsBalance || 0n,
      userUsdsBalance: userUsdsBalance?.value || 0n,
      userSuppliedUsds,
      userMaxDeposit: userMaxDeposit || 0n,
      userMaxWithdraw: userMaxWithdraw || 0n,
      moduleRate: ysr || 0n,
      chi: chi || 0n,
      cap: cap || 0n,
      line: line || 0n
    };
  }, [
    contractData,
    totalAssets,
    totalSupply,
    assetPerShare,
    availableLiquidity,
    userStUsdsBalance,
    userUsdsBalance,
    userSuppliedUsds,
    userMaxDeposit,
    userMaxWithdraw,
    ysr,
    chi,
    cap,
    line
  ]);

  const dataSources: DataSource[] = [
    {
      title: 'stUSDS Contract',
      onChain: true,
      href: getEtherscanLink(chainId, stUsdsContractAddress, 'address'),
      trustLevel: TRUST_LEVELS[TrustLevelEnum.ZERO]
    }
  ];

  return {
    isLoading,
    error: contractError || null,
    data,
    mutate: () => {
      mutateContractData();
      mutateConvertToAssets();
      mutateUserUsdsBalance();
      refetchStakingEngine();
    },
    dataSources
  };
}
