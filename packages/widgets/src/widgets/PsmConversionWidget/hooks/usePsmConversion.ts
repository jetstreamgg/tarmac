import {
  psm3L2Address,
  usdsPsmWrapperAddress,
  useBatchPsmSwapExactIn,
  useBatchUsdsPsmWrapperBuyGem,
  useBatchUsdsPsmWrapperSellGem,
  useIsBatchSupported,
  usePsmPocketBalance,
  useTokenAllowance,
  useUsdsPsmWrapperHalted,
  useUsdsPsmWrapperLive,
  useUsdsPsmWrapperTin,
  useUsdsPsmWrapperTout
} from '@jetstreamgg/sky-hooks';
import type { BatchWriteHookParams } from '@jetstreamgg/sky-hooks';
import { isL2ChainId } from '@jetstreamgg/sky-utils';
import { useMemo } from 'react';
import { useChainId, useConnection } from 'wagmi';
import {
  getPsmConversionTokens,
  getPsmDisabledReason,
  getPsmExecutionAmounts,
  type PsmConversionDirection,
  type PsmConversionDisabledReason
} from './usePsmConversion.helpers';

export interface UsePsmConversionParams extends BatchWriteHookParams {
  direction: PsmConversionDirection;
  amount: bigint;
  referralCode?: number;
  chainIdOverride?: number;
}

export interface UsePsmConversionResult {
  direction: PsmConversionDirection;
  chainId: number;
  isL2: boolean;
  isMainnetWrapper: boolean;
  originToken?: ReturnType<typeof getPsmConversionTokens>['originToken'];
  targetToken?: ReturnType<typeof getPsmConversionTokens>['targetToken'];
  originAmount: bigint;
  targetAmount: bigint;
  feeWad?: bigint;
  hasNonZeroFee: boolean;
  haltedValue?: bigint;
  isDirectionHalted: boolean;
  isLive?: boolean;
  disabledReason?: PsmConversionDisabledReason;
  spender?: `0x${string}`;
  allowance?: bigint;
  needsAllowance: boolean;
  batchSupported?: boolean;
  shouldUseBatch: boolean;
  pocketBalance?: bigint;
  hasSufficientLiquidity?: boolean;
  mutateAllowance: () => void;
  mutatePocketBalance: () => void;
  prepared: boolean;
  isLoading: boolean;
  error: Error | null;
  execute: () => void;
  currentCallIndex: number;
  reset: () => void;
  execution: {
    l2AmountIn: bigint;
    l2MinAmountOut: bigint;
    mainnetGemAmt: bigint;
    mainnetUsdsAmountInWad: bigint;
  };
}

export function usePsmConversion({
  direction,
  amount,
  referralCode,
  chainIdOverride,
  enabled: paramEnabled = true,
  shouldUseBatch = true,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null
}: UsePsmConversionParams): UsePsmConversionResult {
  const connectedChainId = useChainId();
  const chainId = chainIdOverride ?? connectedChainId;
  const isL2 = isL2ChainId(chainId);
  const { address } = useConnection();
  const { originToken, targetToken } = useMemo(() => getPsmConversionTokens(chainId, direction), [chainId, direction]);
  const execution = useMemo(() => getPsmExecutionAmounts(direction, amount), [direction, amount]);

  const spender = isL2
    ? psm3L2Address[chainId as keyof typeof psm3L2Address]
    : usdsPsmWrapperAddress[chainId as keyof typeof usdsPsmWrapperAddress];

  const { data: allowance, mutate: mutateAllowance } = useTokenAllowance({
    chainId,
    contractAddress: originToken?.address,
    owner: address,
    spender
  });

  const { data: batchSupported } = useIsBatchSupported();
  const { data: live, refetch: refetchLive } = useUsdsPsmWrapperLive({ chainIdOverride: chainId });
  const { data: tin, refetch: refetchTin } = useUsdsPsmWrapperTin({ chainIdOverride: chainId });
  const { data: tout, refetch: refetchTout } = useUsdsPsmWrapperTout({ chainIdOverride: chainId });
  const { data: haltedValue, refetch: refetchHalted } = useUsdsPsmWrapperHalted({ chainIdOverride: chainId });
  const {
    data: pocketBalanceData,
    refetch: refetchPocketBalance
  } = usePsmPocketBalance({ chainIdOverride: chainId });

  const feeWad = isL2 ? 0n : direction === 'USDC_TO_USDS' ? tin : tout;
  const hasNonZeroFee = !isL2 && feeWad !== undefined && feeWad > 0n;
  const isDirectionHalted =
    !isL2 && haltedValue !== undefined && feeWad !== undefined && haltedValue === feeWad;
  const isLive = isL2 ? true : live === 1n;
  const pocketBalance = pocketBalanceData?.value;
  const hasSufficientLiquidity =
    direction === 'USDC_TO_USDS' || isL2
      ? true
      : pocketBalance !== undefined
        ? pocketBalance >= execution.mainnetGemAmt
        : undefined;

  const disabledReason = getPsmDisabledReason({
    chainId,
    amount,
    mainnetGemAmt: execution.mainnetGemAmt,
    isLive,
    isDirectionHalted,
    hasNonZeroFee,
    hasSufficientLiquidity
  });

  const needsAllowance = !!originToken?.address && amount > 0n && (!allowance || allowance < amount);
  const effectiveShouldUseBatch = !!shouldUseBatch && !!batchSupported && needsAllowance;
  const hookEnabled = paramEnabled && amount > 0n && !disabledReason && !!originToken?.address && !!targetToken?.address;

  const l2SwapExactIn = useBatchPsmSwapExactIn({
    amountIn: execution.l2AmountIn,
    assetIn: originToken?.address as `0x${string}`,
    assetOut: targetToken?.address as `0x${string}`,
    minAmountOut: execution.l2MinAmountOut,
    referralCode: referralCode ? BigInt(referralCode) : undefined,
    shouldUseBatch: effectiveShouldUseBatch,
    enabled: hookEnabled && isL2,
    onMutate,
    onSuccess,
    onError,
    onStart
  });

  const mainnetSellGem = useBatchUsdsPsmWrapperSellGem({
    gemAmt: execution.mainnetGemAmt,
    chainIdOverride: chainId,
    shouldUseBatch: effectiveShouldUseBatch,
    enabled: hookEnabled && !isL2 && direction === 'USDC_TO_USDS',
    onMutate,
    onSuccess,
    onError,
    onStart
  });

  const mainnetBuyGem = useBatchUsdsPsmWrapperBuyGem({
    gemAmt: execution.mainnetGemAmt,
    usdsAmountInWad: execution.mainnetUsdsAmountInWad,
    chainIdOverride: chainId,
    shouldUseBatch: effectiveShouldUseBatch,
    enabled: hookEnabled && !isL2 && direction === 'USDS_TO_USDC',
    onMutate,
    onSuccess,
    onError,
    onStart
  });

  const activeHook = isL2
    ? l2SwapExactIn
    : direction === 'USDC_TO_USDS'
      ? mainnetSellGem
      : mainnetBuyGem;

  return {
    direction,
    chainId,
    isL2,
    isMainnetWrapper: !isL2,
    originToken,
    targetToken,
    originAmount: amount,
    targetAmount: execution.targetAmount,
    feeWad,
    hasNonZeroFee,
    haltedValue,
    isDirectionHalted,
    isLive,
    disabledReason,
    spender,
    allowance,
    needsAllowance,
    batchSupported,
    shouldUseBatch: effectiveShouldUseBatch,
    pocketBalance,
    hasSufficientLiquidity,
    mutateAllowance,
    mutatePocketBalance: () => {
      mutateAllowance();
      refetchLive();
      refetchTin();
      refetchTout();
      refetchHalted();
      refetchPocketBalance();
    },
    prepared: activeHook.prepared,
    isLoading: activeHook.isLoading,
    error: activeHook.error,
    execute: activeHook.execute,
    currentCallIndex: activeHook.currentCallIndex,
    reset: activeHook.reset,
    execution: {
      l2AmountIn: execution.l2AmountIn,
      l2MinAmountOut: execution.l2MinAmountOut,
      mainnetGemAmt: execution.mainnetGemAmt,
      mainnetUsdsAmountInWad: execution.mainnetUsdsAmountInWad
    }
  };
}
