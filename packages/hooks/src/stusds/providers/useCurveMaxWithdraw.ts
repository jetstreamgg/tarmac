import { useChainId } from 'wagmi';
import { useReadCurveStUsdsUsdsPoolGetDy } from '../../generated';
import { isTestnetId } from '@jetstreamgg/sky-utils';
import { TENDERLY_CHAIN_ID } from '../../constants';
import { useCurvePoolData } from './useCurvePoolData';

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
 * This is needed because the vault's stUSDS → USDS conversion rate may differ
 * from Curve's exchange rate. Using the vault rate for max calculation can result
 * in trying to swap more stUSDS than the user has.
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

  // Return the raw get_dy output for display purposes
  // The slippage protection is handled at the transaction level (minOutput in swap calls),
  // not at the max amount display level
  return {
    maxUsdsOutput: usdsOutput,
    rawUsdsOutput: usdsOutput,
    isLoading: isPoolLoading || isOutputLoading,
    error: error as Error | null
  };
}
