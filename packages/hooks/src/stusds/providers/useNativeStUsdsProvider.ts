import { useMemo } from 'react';
import { useStUsdsData } from '../useStUsdsData';
import { useStUsdsCapacityData } from '../useStUsdsCapacityData';
import { useStUsdsPreviewDeposit } from '../useStUsdsPreviewDeposit';
import { useStUsdsPreviewWithdraw } from '../useStUsdsPreviewWithdraw';
import { calculateEffectiveRate } from './rateComparison';
import {
  StUsdsProviderType,
  StUsdsProviderStatus,
  StUsdsProviderData,
  StUsdsProviderState,
  StUsdsQuote,
  StUsdsQuoteParams,
  StUsdsProviderHookResult,
  StUsdsRateInfo,
  StUsdsBlockedReason,
  StUsdsDirection
} from './types';

/**
 * Hook that wraps the native stUSDS contract into the provider abstraction.
 * This allows the native contract to be used interchangeably with other providers like Curve.
 *
 * @param params - Quote parameters (amount and direction)
 * @returns Provider data in the standard format
 */
export function useNativeStUsdsProvider(params: StUsdsQuoteParams): StUsdsProviderHookResult {
  const { amount, direction } = params;

  // Get native stUSDS data
  const {
    data: stUsdsData,
    isLoading: isDataLoading,
    error: dataError,
    mutate: refetchData
  } = useStUsdsData();

  // Get capacity data for deposit availability
  const {
    data: capacityData,
    isLoading: isCapacityLoading,
    error: capacityError,
    mutate: refetchCapacity
  } = useStUsdsCapacityData();

  // Get preview for deposit (USDS -> stUSDS)
  const {
    data: previewDeposit,
    isLoading: isDepositPreviewLoading,
    error: depositPreviewError,
    mutate: refetchDepositPreview
  } = useStUsdsPreviewDeposit(direction === StUsdsDirection.SUPPLY ? amount : 0n);

  // Get preview for withdraw (stUSDS -> USDS)
  const {
    data: previewWithdraw,
    isLoading: isWithdrawPreviewLoading,
    error: withdrawPreviewError,
    mutate: refetchWithdrawPreview
  } = useStUsdsPreviewWithdraw(direction === StUsdsDirection.WITHDRAW ? amount : 0n);

  // Determine provider state
  const state: StUsdsProviderState | undefined = useMemo(() => {
    if (!stUsdsData || !capacityData) return undefined;

    // Check if deposits are available for the requested amount
    const hasAnyDepositCapacity = capacityData.remainingCapacityBuffered > 0n;
    const canDeposit = amount > 0n ? amount <= capacityData.remainingCapacityBuffered : hasAnyDepositCapacity;

    // Check if withdrawals are available for the requested amount
    const hasAnyWithdrawLiquidity = stUsdsData.availableLiquidityBuffered > 0n;
    const canWithdraw =
      amount > 0n ? amount <= stUsdsData.availableLiquidityBuffered : hasAnyWithdrawLiquidity;

    // Determine overall status
    let status: StUsdsProviderStatus;
    if (direction === StUsdsDirection.SUPPLY) {
      status = canDeposit ? StUsdsProviderStatus.AVAILABLE : StUsdsProviderStatus.BLOCKED;
    } else {
      status = canWithdraw ? StUsdsProviderStatus.AVAILABLE : StUsdsProviderStatus.BLOCKED;
    }

    let blockedReason: StUsdsBlockedReason | undefined;
    if (status === StUsdsProviderStatus.BLOCKED) {
      if (direction === StUsdsDirection.SUPPLY) {
        blockedReason = hasAnyDepositCapacity
          ? StUsdsBlockedReason.AMOUNT_EXCEEDS_SUPPLY_CAPACITY
          : StUsdsBlockedReason.SUPPLY_CAPACITY_REACHED;
      } else {
        blockedReason = hasAnyWithdrawLiquidity
          ? StUsdsBlockedReason.AMOUNT_EXCEEDS_LIQUIDITY
          : StUsdsBlockedReason.LIQUIDITY_EXHAUSTED;
      }
    }

    return {
      providerType: StUsdsProviderType.NATIVE,
      status,
      canDeposit,
      canWithdraw,
      maxDeposit: capacityData.remainingCapacityBuffered,
      maxWithdraw: stUsdsData.userMaxWithdrawBuffered,
      blockedReason
    };
  }, [stUsdsData, capacityData, direction, amount]);

  // Build quote if amount > 0
  const quote: StUsdsQuote | undefined = useMemo(() => {
    if (!state || amount === 0n) return undefined;

    let inputAmount: bigint;
    let outputAmount: bigint | undefined;

    if (direction === StUsdsDirection.SUPPLY) {
      // Supply: USDS in, stUSDS out
      inputAmount = amount;
      outputAmount = previewDeposit;
    } else {
      // Withdraw: stUSDS in, USDS out
      // previewWithdraw returns shares needed for the desired USDS amount
      inputAmount = previewWithdraw || 0n;
      outputAmount = amount;
    }

    if (outputAmount === undefined || outputAmount === 0n || inputAmount === 0n) {
      return {
        providerType: StUsdsProviderType.NATIVE,
        inputAmount: direction === StUsdsDirection.SUPPLY ? amount : 0n,
        outputAmount: direction === StUsdsDirection.SUPPLY ? 0n : amount,
        rateInfo: {
          outputAmount: 0n,
          effectiveRate: 0n,
          feeAmount: 0n,
          estimatedSlippageBps: 0,
          priceImpactBps: 0
        },
        isValid: false,
        invalidReason: 'Unable to get quote'
      };
    }

    // Check if the operation is valid given current limits
    let isValid = true;
    let invalidReason: string | undefined;

    if (direction === StUsdsDirection.SUPPLY) {
      if (!state.canDeposit) {
        isValid = false;
        invalidReason =
          state.blockedReason === StUsdsBlockedReason.AMOUNT_EXCEEDS_SUPPLY_CAPACITY
            ? 'Amount exceeds remaining capacity'
            : 'Deposits are currently unavailable';
      }
    } else {
      if (!state.canWithdraw) {
        isValid = false;
        invalidReason =
          state.blockedReason === StUsdsBlockedReason.AMOUNT_EXCEEDS_LIQUIDITY
            ? 'Amount exceeds available liquidity'
            : 'Withdrawals are currently unavailable';
      } else if (state.maxWithdraw !== undefined && amount > state.maxWithdraw) {
        isValid = false;
        invalidReason = 'Amount exceeds available liquidity';
      }
    }

    // Calculate effective rate
    const effectiveRate = calculateEffectiveRate(inputAmount, outputAmount);

    const rateInfo: StUsdsRateInfo = {
      outputAmount,
      effectiveRate,
      feeAmount: 0n, // Native contract has no explicit fees
      estimatedSlippageBps: 0, // Native contract has no slippage
      priceImpactBps: 0 // Native contract has no price impact
    };

    const stUsdsAmount = direction === StUsdsDirection.SUPPLY ? outputAmount : inputAmount;

    return {
      providerType: StUsdsProviderType.NATIVE,
      inputAmount,
      outputAmount,
      stUsdsAmount,
      rateInfo,
      isValid,
      invalidReason
    };
  }, [state, amount, direction, previewDeposit, previewWithdraw]);

  // Combine into provider data
  const data: StUsdsProviderData | undefined = useMemo(() => {
    if (!state) return undefined;

    return {
      providerType: StUsdsProviderType.NATIVE,
      state,
      quote
    };
  }, [state, quote]);

  const isLoading =
    isDataLoading ||
    isCapacityLoading ||
    (direction === StUsdsDirection.SUPPLY && amount > 0n && isDepositPreviewLoading) ||
    (direction === StUsdsDirection.WITHDRAW && amount > 0n && isWithdrawPreviewLoading);

  const error = dataError || capacityError || depositPreviewError || withdrawPreviewError;

  const refetch = () => {
    refetchData();
    refetchCapacity();
    refetchDepositPreview();
    refetchWithdrawPreview();
  };

  return {
    data,
    isLoading,
    error: error as Error | null,
    refetch
  };
}
