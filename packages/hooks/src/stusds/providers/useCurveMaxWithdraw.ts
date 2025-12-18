import { useChainId } from 'wagmi';
import { useReadCurveStUsdsUsdsPoolGetDy } from '../../generated';
import { isTestnetId } from '@jetstreamgg/sky-utils';
import { TENDERLY_CHAIN_ID } from '../../constants';
import { useCurvePoolData } from './useCurvePoolData';
import { STUSDS_PROVIDER_CONFIG, RATE_PRECISION } from './constants';

export type CurveMaxWithdrawParams = {
  /** User's stUSDS balance */
  userStUsdsBalance: bigint;
  /** Whether the query should be enabled */
  enabled?: boolean;
};

export type CurveMaxWithdrawResult = {
  /** Maximum USDS the user can withdraw via Curve (with slippage buffer) */
  maxUsdsOutput: bigint | undefined;
  /** Raw USDS output without slippage buffer */
  rawUsdsOutput: bigint | undefined;
  /** Whether the data is loading */
  isLoading: boolean;
  /** Error if the query failed */
  error: Error | null;
};

/**
 * Hook to calculate the maximum USDS a user can withdraw via Curve
 * based on their stUSDS balance.
 *
 * Uses get_dy(stUsds_idx, usds_idx, userStUsdsBalance) to get the exact
 * USDS output for the user's full stUSDS balance, then applies a slippage buffer.
 *
 * The buffer is necessary because:
 * 1. User clicks 100% → we show buffered max USDS
 * 2. Quote calls get_dx(usdsAmount) to find stUSDS needed
 * 3. If rate shifts between get_dy and get_dx, without buffer the required
 *    stUSDS could exceed user's balance → "insufficient funds" error
 *
 * By showing a slightly lower max (99.5%), we ensure that get_dx will return
 * an stUSDS amount within the user's balance even with small rate fluctuations.
 */
export function useCurveMaxWithdraw(params: CurveMaxWithdrawParams): CurveMaxWithdrawResult {
  const { userStUsdsBalance, enabled = true } = params;

  const connectedChainId = useChainId();
  const chainId = isTestnetId(connectedChainId) ? TENDERLY_CHAIN_ID : 1;

  // Get pool data to determine token indices
  const { data: poolData, isLoading: isPoolLoading } = useCurvePoolData();

  const stUsdsIndex = poolData?.tokenIndices.stUsds ?? 1;
  const usdsIndex = poolData?.tokenIndices.usds ?? 0;

  // Get USDS output for user's full stUSDS balance
  // get_dy(stUsds_idx, usds_idx, stUsdsAmount) → USDS output
  const {
    data: usdsOutput,
    isLoading: isOutputLoading,
    error
  } = useReadCurveStUsdsUsdsPoolGetDy({
    args: [BigInt(stUsdsIndex), BigInt(usdsIndex), userStUsdsBalance],
    chainId,
    query: {
      enabled: enabled && userStUsdsBalance > 0n && !!poolData
    }
  });

  // Apply slippage buffer to get a conservative max
  // This ensures that when the user inputs this max amount, the required stUSDS
  // (calculated via get_dx) will not exceed their balance due to rate fluctuations
  const slippageMultiplier = RATE_PRECISION.BPS_DIVISOR - BigInt(STUSDS_PROVIDER_CONFIG.maxSlippageBps);

  const maxUsdsOutput =
    usdsOutput !== undefined ? (usdsOutput * slippageMultiplier) / RATE_PRECISION.BPS_DIVISOR : undefined;

  return {
    maxUsdsOutput,
    rawUsdsOutput: usdsOutput,
    isLoading: isPoolLoading || isOutputLoading,
    error: error as Error | null
  };
}
