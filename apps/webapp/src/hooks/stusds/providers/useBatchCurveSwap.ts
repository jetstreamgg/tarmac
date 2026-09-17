import { useConnection, useChainId } from 'wagmi';
import { Abi } from 'viem';
import { StUsdsDirection } from './types';
import {
  curveStUsdsUsdsPoolAddress,
  curveStUsdsUsdsPoolAbi,
  usdsAddress,
  stUsdsAddress
} from '../../generated';
import { BatchWriteHookParams } from '../../hooks';
import { getWriteContractCall } from '../../shared/getWriteContractCall';
import { ApproveThenActHook, useApproveThenAct } from '../../shared/useApproveThenAct';
import { familyMainnetId } from '@/utils';
import { useCurveAllowance } from './useCurveAllowance';
import { useCurvePoolData } from './useCurvePoolData';
import { calculateMinOutputWithSlippage } from './rateComparison';
import { STUSDS_PROVIDER_CONFIG } from './constants';

export type BatchCurveSwapParams = BatchWriteHookParams & {
  /** Direction of the swap */
  direction: StUsdsDirection;
  /** Amount of input token */
  inputAmount: bigint;
  /** Expected output amount (from quote) */
  expectedOutput: bigint;
  /** Custom slippage tolerance in bps (optional, defaults to config) */
  slippageBps?: number;
};

/**
 * Swap on the Curve USDS/stUSDS pool: optional approve(input token) →
 * `exchange(i, j, dx, min_dy, receiver)`, with the min output derived from the
 * quote at the configured slippage.
 */
export function useBatchCurveSwap({
  direction,
  inputAmount,
  expectedOutput,
  slippageBps = STUSDS_PROVIDER_CONFIG.maxSlippageBps,
  enabled = true,
  ...flow
}: BatchCurveSwapParams): ApproveThenActHook {
  const { address } = useConnection();
  const chainId = familyMainnetId(useChainId());
  const isSupply = direction === StUsdsDirection.SUPPLY;

  const { data: allowance, error: allowanceError } = useCurveAllowance({
    token: isSupply ? 'USDS' : 'stUSDS',
    amount: inputAmount
  });

  // Token indices come from the pool; the fallbacks are the pool's known order.
  const { data: poolData } = useCurvePoolData();
  const usdsIndex = poolData?.tokenIndices.usds ?? 0;
  const stUsdsIndex = poolData?.tokenIndices.stUsds ?? 1;
  const [inputIndex, outputIndex] = isSupply ? [usdsIndex, stUsdsIndex] : [stUsdsIndex, usdsIndex];

  const inputToken = isSupply
    ? usdsAddress[chainId as keyof typeof usdsAddress]
    : stUsdsAddress[chainId as keyof typeof stUsdsAddress];
  const pool = curveStUsdsUsdsPoolAddress[chainId as keyof typeof curveStUsdsUsdsPoolAddress];
  const minOutput = calculateMinOutputWithSlippage(expectedOutput, slippageBps);

  return useApproveThenAct({
    ...flow,
    chainId,
    enabled: enabled && !!poolData && inputAmount > 0n && expectedOutput > 0n,
    legs: [
      {
        approve: { token: inputToken, spender: pool, amount: inputAmount, allowance, allowanceError },
        calls: address
          ? [
              getWriteContractCall({
                to: pool,
                abi: curveStUsdsUsdsPoolAbi as Abi,
                functionName: 'exchange',
                args: [BigInt(inputIndex), BigInt(outputIndex), inputAmount, minOutput, address]
              })
            ]
          : []
      }
    ]
  });
}
