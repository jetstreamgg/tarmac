import { useAccount, useChainId } from 'wagmi';
import { Abi } from 'viem';
import { curveStUsdsUsdsPoolAddress, curveStUsdsUsdsPoolAbi } from '../../generated';
import { WriteHook, WriteHookParams } from '../../hooks';
import { useWriteContractFlow } from '../../shared/useWriteContractFlow';
import { isTestnetId } from '@jetstreamgg/sky-utils';
import { TENDERLY_CHAIN_ID } from '../../constants';
import { useCurvePoolData } from './useCurvePoolData';
import { calculateMinOutputWithSlippage } from './rateComparison';
import { STUSDS_PROVIDER_CONFIG } from './constants';
import { StUsdsDirection } from './types';

export type CurveSwapParams = WriteHookParams & {
  /** Direction of the swap */
  direction: StUsdsDirection;
  /** Amount of input token */
  inputAmount: bigint;
  /** Expected output amount (from quote) */
  expectedOutput: bigint;
  /** Custom slippage tolerance in bps (optional, defaults to config) */
  slippageBps?: number;
  /** Receiver address (optional, defaults to connected wallet) */
  receiver?: `0x${string}`;
};

/**
 * Hook to execute a swap on the Curve USDS/stUSDS pool.
 *
 * @param params - Swap parameters including direction, amounts, and callbacks
 * @returns Write hook for the swap transaction
 */
export function useCurveSwap({
  direction,
  inputAmount,
  expectedOutput,
  slippageBps = STUSDS_PROVIDER_CONFIG.maxSlippageBps,
  receiver,
  gas,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null,
  enabled: activeEnabled = true
}: CurveSwapParams): WriteHook {
  const { address: connectedAddress, isConnected } = useAccount();
  const connectedChainId = useChainId();
  const chainId = isTestnetId(connectedChainId) ? TENDERLY_CHAIN_ID : 1;

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

  // Receiver defaults to connected address
  const receiverAddress = receiver || connectedAddress;

  // Enable only when all conditions are met
  const enabled =
    isConnected &&
    !!connectedAddress &&
    !!poolData &&
    !!receiverAddress &&
    inputAmount > 0n &&
    expectedOutput > 0n &&
    activeEnabled;

  const poolAddress = curveStUsdsUsdsPoolAddress[chainId as keyof typeof curveStUsdsUsdsPoolAddress];

  return useWriteContractFlow({
    address: poolAddress,
    abi: curveStUsdsUsdsPoolAbi as Abi,
    functionName: 'exchange',
    // Args: i (input index), j (output index), _dx (input amount), _min_dy (min output), _receiver
    args: receiverAddress
      ? ([BigInt(inputIndex), BigInt(outputIndex), inputAmount, minOutput, receiverAddress] as const)
      : undefined,
    chainId,
    gas,
    enabled,
    onMutate,
    onSuccess,
    onError,
    onStart
  });
}
