import { useMemo } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { chainId, isTestnetId } from '@jetstreamgg/sky-utils';
import { WriteHook, WriteHookParams } from '../hooks';
import { useWriteContractFlow } from '../shared/useWriteContractFlow';
import {
  PENDLE_QUOTE_TTL_MS,
  PENDLE_ROUTER_V4_ABI,
  PENDLE_ROUTER_V4_ADDRESS,
  PendleConvertSide
} from './constants';
import type { PendleConvertQuote } from './pendle';
import { buildVerifiedArgs } from './buildVerifiedArgs';

type UsePendleConvertParams = WriteHookParams & {
  side: PendleConvertSide;
  marketAddress?: `0x${string}`;
  /** For BUY: underlying token. For WITHDRAW: PT token. */
  inputToken?: `0x${string}`;
  /** For BUY: PT token. For WITHDRAW: underlying token. */
  outputToken?: `0x${string}`;
  /** For BUY: underlying amount in wei. For WITHDRAW: PT amount in wei. */
  amountIn?: bigint;
  /** Decimal slippage (e.g. 0.002 = 0.2%) */
  slippage: number;
  /** The latest quote from useQuotePendleConvert */
  quote?: PendleConvertQuote;
};

/**
 * Write hook for Pendle PT convert (Buy or Withdraw).
 *
 * Pipeline:
 *   1. Stale-quote guard (Date.now() - fetchedAt < PENDLE_QUOTE_TTL_MS)
 *   2. buildVerifiedArgs() — pinned router + selector allowlist + override
 *      matrix + force-empty pendleSwap/swapData/limit (see buildVerifiedArgs.ts)
 *   3. useWriteContractFlow() — viem encodes calldata from the verified args.
 *      The user signs OUR calldata, never the API's tx.data.
 *
 * If the quote is stale, missing, or fails verification, the hook returns
 * `prepared: false` with `prepareError` populated. Caller should refetch the
 * quote (via useQuotePendleConvert.mutate) and re-render.
 */
export function usePendleConvert({
  side,
  marketAddress,
  inputToken,
  outputToken,
  amountIn,
  slippage,
  quote,
  enabled: enabledParam = true,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null
}: UsePendleConvertParams): WriteHook & { prepareError: Error | null } {
  const { address: connectedAddress, isConnected } = useConnection();
  const connectedChainId = useChainId();
  const chainIdToUse = isTestnetId(connectedChainId) ? chainId.tenderly : chainId.mainnet;
  const routerAddress = PENDLE_ROUTER_V4_ADDRESS[chainIdToUse];

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
        amountIn,
        slippage
      });
      return { verified: v, verifyError: null };
    } catch (e) {
      return { verified: undefined, verifyError: e as Error };
    }
  }, [quote, marketAddress, inputToken, outputToken, amountIn, slippage, connectedAddress, side]);

  const enabled =
    enabledParam &&
    isConnected &&
    !!verified &&
    !!routerAddress &&
    !!amountIn &&
    amountIn !== 0n;

  const flow = useWriteContractFlow({
    address: routerAddress,
    abi: PENDLE_ROUTER_V4_ABI,
    functionName: verified?.functionName ?? 'swapExactTokenForPt',
    // Cast: the ABI is a const-asserted union, so verified.args is the
    // discriminated correct shape for verified.functionName.
    args: verified?.args as never,
    // value omitted (0 default) — v1 has no native-ETH input
    chainId: chainIdToUse,
    scopeKey: `pendle-convert-${side}-${marketAddress}-${amountIn}-${slippage}`,
    enabled,
    onMutate,
    onStart,
    onSuccess,
    onError
  });

  return {
    ...flow,
    prepareError: verifyError ?? flow.prepareError ?? null
  };
}
