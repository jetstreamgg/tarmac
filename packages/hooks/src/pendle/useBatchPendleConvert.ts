import { useMemo } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { Call, erc20Abi } from 'viem';
import { chainId, isTestnetId } from '@jetstreamgg/sky-utils';
import { BatchWriteHook, BatchWriteHookParams } from '../hooks';
import { getWriteContractCall } from '../shared/getWriteContractCall';
import { useTransactionFlow } from '../shared/useTransactionFlow';
import { useTokenAllowance } from '../tokens/useTokenAllowance';
import {
  PENDLE_QUOTE_TTL_MS,
  PENDLE_ROUTER_V4_ABI,
  PENDLE_ROUTER_V4_ADDRESS,
  PendleConvertSide
} from './constants';
import type { PendleConvertQuote } from './pendle';
import { buildVerifiedArgs } from './buildVerifiedArgs';

type UseBatchPendleConvertParams = BatchWriteHookParams & {
  side: PendleConvertSide;
  marketAddress?: `0x${string}`;
  /** For BUY: underlying token. For WITHDRAW: PT token. */
  inputToken?: `0x${string}`;
  /** For BUY: PT token. For WITHDRAW: underlying token. */
  outputToken?: `0x${string}`;
  /** For BUY: underlying amount in wei. For WITHDRAW: PT amount in wei. */
  amountIn?: bigint;
  /** The latest quote from useQuotePendleConvert */
  quote?: PendleConvertQuote;
};

/**
 * Batch-aware write hook for Pendle PT convert (Buy or Withdraw).
 *
 * Bundles the ERC-20 approval (for input token → router) and the convert call
 * into a single signature when the wallet supports EIP-5792, otherwise falls
 * back to sequential signing. The approve call is included only when current
 * allowance is below the input amount.
 *
 * Pipeline for the convert call:
 *   1. Stale-quote guard (Date.now() - fetchedAt < PENDLE_QUOTE_TTL_MS)
 *   2. buildVerifiedArgs() — selector allowlist + override matrix +
 *      force-empty pendleSwap/swapData/limit (see buildVerifiedArgs.ts)
 *   3. Calldata is encoded by viem from the verified args. The user signs
 *      OUR calldata, never the API's tx.data.
 *
 * If the quote is stale, missing, or fails verification, the hook returns
 * `prepared: false` with `error` populated.
 */
export function useBatchPendleConvert({
  side,
  marketAddress,
  inputToken,
  outputToken,
  amountIn,
  quote,
  enabled: activeTabEnabled = true,
  shouldUseBatch = true,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null
}: UseBatchPendleConvertParams): BatchWriteHook {
  const { address: connectedAddress, isConnected } = useConnection();
  const connectedChainId = useChainId();
  const chainIdToUse = isTestnetId(connectedChainId) ? chainId.tenderly : chainId.mainnet;
  const routerAddress = PENDLE_ROUTER_V4_ADDRESS[chainIdToUse];

  // Allowance for the input token (underlying for Buy, PT for Withdraw) → router
  const { data: allowance, error: allowanceError } = useTokenAllowance({
    chainId: chainIdToUse,
    contractAddress: inputToken,
    owner: connectedAddress,
    spender: routerAddress
  });

  const hasAllowance = allowance !== undefined && amountIn !== undefined && allowance >= amountIn;

  // Verify the quote and rebuild args. Memoised so the verification only runs
  // when an input changes — guards otherwise re-throw on every render.
  const { verified, verifyError } = useMemo(() => {
    if (!quote || !marketAddress || !inputToken || !outputToken || !amountIn || !connectedAddress) {
      return { verified: undefined, verifyError: null as Error | null };
    }
    if (Date.now() - quote.fetchedAt > PENDLE_QUOTE_TTL_MS) {
      return {
        verified: undefined,
        verifyError: new Error('Pendle: quote is stale — please refresh')
      };
    }
    try {
      const v = buildVerifiedArgs(quote, {
        side,
        receiver: connectedAddress,
        market: marketAddress,
        inputToken,
        outputToken,
        amountIn
      });
      return { verified: v, verifyError: null };
    } catch (e) {
      return { verified: undefined, verifyError: e as Error };
    }
  }, [quote, marketAddress, inputToken, outputToken, amountIn, connectedAddress, side]);

  // Build the call list: optional approve, then convert.
  const calls: Call[] = [];
  if (!hasAllowance && inputToken && amountIn) {
    calls.push(
      getWriteContractCall({
        to: inputToken,
        abi: erc20Abi,
        functionName: 'approve',
        args: [routerAddress, amountIn]
      })
    );
  }
  if (verified) {
    calls.push(
      getWriteContractCall({
        to: routerAddress,
        abi: PENDLE_ROUTER_V4_ABI,
        functionName: verified.functionName,
        args: verified.args
      })
    );
  }

  const enabled =
    activeTabEnabled &&
    isConnected &&
    !!verified &&
    !!routerAddress &&
    !!amountIn &&
    amountIn !== 0n &&
    allowance !== undefined;

  const flow = useTransactionFlow({
    calls,
    chainId: chainIdToUse,
    enabled,
    shouldUseBatch,
    onMutate,
    onStart,
    onSuccess,
    onError
  });

  return {
    ...flow,
    error: flow.error || allowanceError || verifyError
  };
}
