import { useMemo } from 'react';
import { useConnection, useChainId, useReadContracts, useReadContract } from 'wagmi';
import { useTokenBalance } from '../tokens/useTokenBalance';
import { usdsAddress, stUsdsAddress, stUsdsImplementationAbi, useReadClipperDue } from '../generated';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { DataSource, ReadHook } from '../hooks';
import { getEtherscanLink, isTestnetId } from '@jetstreamgg/sky-utils';
import { useCollateralData } from '../vaults/useCollateralData';
import { getIlkName } from '../vaults/helpers';
import { calculateLiquidityBuffer } from './helpers';

export type StUsdsHookData = {
  totalAssets: bigint;
  totalSupply: bigint;
  assetPerShare: bigint;
  availableLiquidity: bigint;
  availableLiquidityBuffered: bigint;
  userStUsdsBalance: bigint;
  userUsdsBalance: bigint;
  userSuppliedUsds: bigint;
  userMaxDeposit: bigint;
  userMaxWithdraw: bigint;
  userMaxWithdrawBuffered: bigint;
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
  const { address: connectedAddress } = useConnection();
  const acct = address || connectedAddress;

  const stUsdsContractAddress = stUsdsAddress[chainId as keyof typeof stUsdsAddress];

  // Get staking engine collateral data for debt calculation
  const stakingEngineIlk = getIlkName(2); // Staking engine is collateral type 2
  const {
    data: stakingEngineData,
    raw: stakingEngineRaw,
    isLoading: isLoadingStakingEngine,
    mutate: refetchStakingEngine
  } = useCollateralData(stakingEngineIlk);

  // Get pending liquidations debt
  const {
    data: clipperDue,
    refetch: refetchClipperDue,
    isLoading: isLoadingClipperDue
  } = useReadClipperDue({
    chainId
  });

  const stUsdsContract = {
    address: stUsdsContractAddress,
    abi: stUsdsImplementationAbi,
    chainId
  } as const;

  // Batch all contract reads into a single multicall
  const {
    data: readData,
    isLoading: isContractLoading,
    error: contractError,
    refetch: mutateContractData
  } = useReadContracts({
    allowFailure: false,
    contracts: [
      {
        ...stUsdsContract,
        functionName: 'totalAssets'
      },
      {
        ...stUsdsContract,
        functionName: 'totalSupply'
      },
      {
        ...stUsdsContract,
        functionName: 'cap'
      },
      {
        ...stUsdsContract,
        functionName: 'line'
      },
      {
        ...stUsdsContract,
        functionName: 'str'
      },
      {
        ...stUsdsContract,
        functionName: 'chi'
      },
      ...(acct
        ? [
            {
              ...stUsdsContract,
              functionName: 'balanceOf',
              args: [acct]
            },
            {
              ...stUsdsContract,
              functionName: 'maxDeposit',
              args: [acct]
            },
            {
              ...stUsdsContract,
              functionName: 'maxWithdraw',
              args: [acct]
            }
          ]
        : [])
    ]
  });

  const contractData = readData as (bigint | undefined)[] | undefined;

  // Extract results from multicall
  const totalAssets = contractData?.[0];
  const totalSupply = contractData?.[1];
  const cap = contractData?.[2];
  const line = contractData?.[3];
  const str = contractData?.[4];
  const chi = contractData?.[5];
  const userStUsdsBalance = acct ? contractData?.[6] : undefined;
  const userMaxDeposit = acct ? contractData?.[7] : undefined;
  const userMaxWithdraw = acct ? contractData?.[8] : undefined;

  const { data: userConvertedAssets, refetch: mutateConvertToAssets } = useReadContract({
    address: stUsdsContractAddress,
    abi: stUsdsImplementationAbi,
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

  const availableLiquidity = useMemo(() => {
    const stakingEngineDebt = stakingEngineData?.totalDaiDebt || 0n;
    const pendingLiquidations = clipperDue || 0n;
    const assets = totalAssets || 0n;
    const totalDebt = stakingEngineDebt + pendingLiquidations;
    return assets > totalDebt ? assets - totalDebt : 0n;
  }, [totalAssets, stakingEngineData?.totalDaiDebt, clipperDue]);

  const liquidityBuffer = useMemo(() => {
    if (!totalAssets || !str) return 0n;
    const stakingEngineDebt = stakingEngineData?.totalDaiDebt || 0n;
    const stakingDuty = stakingEngineRaw?.duty?.value || 0n;
    return calculateLiquidityBuffer(totalAssets, str, stakingEngineDebt, stakingDuty);
  }, [totalAssets, str, stakingEngineData?.totalDaiDebt, stakingEngineRaw?.duty]);

  const userMaxWithdrawBuffered = useMemo(() => {
    if (!userMaxWithdraw || !availableLiquidity) return 0n;

    const bufferedLiquidity =
      availableLiquidity > liquidityBuffer ? availableLiquidity - liquidityBuffer : 0n;

    // Only apply buffer if protocol liquidity is the limiting factor
    if (userMaxWithdraw <= bufferedLiquidity) {
      return userMaxWithdraw;
    }

    return bufferedLiquidity;
  }, [userMaxWithdraw, availableLiquidity, liquidityBuffer]);

  const availableLiquidityBuffered = useMemo(() => {
    if (!availableLiquidity) return 0n;
    return availableLiquidity > liquidityBuffer ? availableLiquidity - liquidityBuffer : 0n;
  }, [availableLiquidity, liquidityBuffer]);

  const isLoading =
    isContractLoading || (!!acct && userUsdsLoading) || isLoadingStakingEngine || isLoadingClipperDue;

  const data: StUsdsHookData | undefined = useMemo(() => {
    if (!contractData) return undefined;

    return {
      totalAssets: totalAssets || 0n,
      totalSupply: totalSupply || 0n,
      assetPerShare,
      availableLiquidity,
      availableLiquidityBuffered,
      userStUsdsBalance: userStUsdsBalance || 0n,
      userUsdsBalance: userUsdsBalance?.value || 0n,
      userSuppliedUsds,
      userMaxDeposit: userMaxDeposit || 0n,
      userMaxWithdraw: userMaxWithdraw || 0n,
      userMaxWithdrawBuffered,
      moduleRate: str || 0n,
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
    availableLiquidityBuffered,
    userStUsdsBalance,
    userUsdsBalance,
    userSuppliedUsds,
    userMaxDeposit,
    userMaxWithdraw,
    userMaxWithdrawBuffered,
    str,
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
      refetchClipperDue();
    },
    dataSources
  };
}
