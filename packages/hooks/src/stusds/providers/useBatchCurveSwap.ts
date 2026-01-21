import { useAccount, useChainId } from 'wagmi';
import { Abi, Call, erc20Abi } from 'viem';
import { StUsdsDirection } from './types';
import {
  curveStUsdsUsdsPoolAddress,
  curveStUsdsUsdsPoolAbi,
  usdsAddress,
  stUsdsAddress
} from '../../generated';
import { BatchWriteHook, BatchWriteHookParams } from '../../hooks';
import { getWriteContractCall } from '../../shared/getWriteContractCall';
import { useTransactionFlow } from '../../shared/useTransactionFlow';
import { isTestnetId } from '@jetstreamgg/sky-utils';
import { TENDERLY_CHAIN_ID } from '../../constants';
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
 * Hook to execute a batched approve + swap on the Curve USDS/stUSDS pool.
 * Combines token approval and swap into a single transaction when possible.
 *
 * @param params - Batch swap parameters including direction, amounts, and callbacks
 * @returns Batch write hook for the transaction
 */
export function useBatchCurveSwap({
  direction,
  inputAmount,
  expectedOutput,
  slippageBps = STUSDS_PROVIDER_CONFIG.maxSlippageBps,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null,
  enabled: activeEnabled = true,
  shouldUseBatch = true
}: BatchCurveSwapParams): BatchWriteHook {
  const { address: connectedAddress, isConnected } = useAccount();
  const connectedChainId = useChainId();
  const chainId = isTestnetId(connectedChainId) ? TENDERLY_CHAIN_ID : 1;

  // Determine which token needs approval based on direction
  const inputToken = direction === StUsdsDirection.SUPPLY ? 'USDS' : 'stUSDS';

  // Check allowance for the input token
  const {
    data: allowance,
    error: allowanceError,
    hasAllowance
  } = useCurveAllowance({
    token: inputToken,
    amount: inputAmount
  });

  // Get pool data to determine token indices
  const { data: poolData } = useCurvePoolData();

  // Determine input/output indices based on direction
  const inputIndex =
    direction === StUsdsDirection.SUPPLY
      ? (poolData?.tokenIndices.usds ?? 0)
      : (poolData?.tokenIndices.stUsds ?? 1);

  const outputIndex =
    direction === StUsdsDirection.SUPPLY
      ? (poolData?.tokenIndices.stUsds ?? 1)
      : (poolData?.tokenIndices.usds ?? 0);

  // Calculate minimum output with slippage protection
  const minOutput = calculateMinOutputWithSlippage(expectedOutput, slippageBps);

  // Get token and pool addresses
  const tokenAddress =
    direction === StUsdsDirection.SUPPLY
      ? usdsAddress[chainId as keyof typeof usdsAddress]
      : stUsdsAddress[chainId as keyof typeof stUsdsAddress];

  const poolAddress = curveStUsdsUsdsPoolAddress[chainId as keyof typeof curveStUsdsUsdsPoolAddress];

  // Build the approval call (if needed)
  const approveCall = getWriteContractCall({
    to: tokenAddress,
    abi: erc20Abi,
    functionName: 'approve',
    args: [poolAddress, inputAmount]
  });

  // Build the swap call
  const swapCall = connectedAddress
    ? getWriteContractCall({
        to: poolAddress,
        abi: curveStUsdsUsdsPoolAbi as Abi,
        functionName: 'exchange',
        args: [BigInt(inputIndex), BigInt(outputIndex), inputAmount, minOutput, connectedAddress]
      })
    : null;

  // Build calls array
  const calls: Call[] = [];
  if (!hasAllowance) calls.push(approveCall);
  if (swapCall) calls.push(swapCall);

  // Enable only when all conditions are met
  const enabled =
    isConnected &&
    !!connectedAddress &&
    !!poolData &&
    inputAmount > 0n &&
    expectedOutput > 0n &&
    allowance !== undefined &&
    activeEnabled;

  const transactionFlowResults = useTransactionFlow({
    calls,
    chainId,
    enabled,
    shouldUseBatch,
    onMutate,
    onSuccess,
    onError,
    onStart
  });

  return {
    ...transactionFlowResults,
    error: transactionFlowResults.error || allowanceError
  };
}
