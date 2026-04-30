import { useQuery } from '@tanstack/react-query';
import { useConnection } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { PENDLE_QUOTE_REFETCH_MS, PendleConvertSide } from './constants';
import type { PendleQuoteHook, PendleConvertQuote } from './pendle';
import { fetchPendleConvert } from './pendleApiClient';

/**
 * Pull the on-chain `minOut` value from the API's contractCallParams.
 * Numeric fields come back as decimal wei strings (JSON has no native bigint).
 * Throws on missing or non-numeric values — a malformed quote must NOT
 * silently fall back to `0n`, which would propagate into the on-chain
 * `minOut` and remove all slippage protection. React Query surfaces the
 * throw as a quote error and the user never gets a sign prompt.
 */
function extractApiMinOut(method: string, params: unknown[]): bigint {
  const fail = (reason: string): never => {
    throw new Error(`Pendle: malformed quote — ${reason}`);
  };

  if (method === 'swapExactTokenForPt') {
    // (receiver, market, minPtOut, guessPtOut, input, limit)
    const raw = params[2];
    if (typeof raw !== 'string') fail('missing minPtOut at apiContractParams[2]');
    return BigInt(raw as string);
  }
  if (method === 'swapExactPtForToken') {
    // (receiver, market, exactPtIn, output, limit)
    const output = params[3] as { minTokenOut?: string } | undefined;
    if (!output?.minTokenOut) fail('missing output.minTokenOut at apiContractParams[3]');
    return BigInt(output!.minTokenOut as string);
  }
  if (method === 'exitPostExpToToken') {
    // (receiver, market, netPtIn, netLpIn, output)
    const output = params[4] as { minTokenOut?: string } | undefined;
    if (!output?.minTokenOut) fail('missing output.minTokenOut at apiContractParams[4]');
    return BigInt(output!.minTokenOut as string);
  }
  return fail(`unknown method "${method}"`);
}

type UseQuotePendleConvertParams = {
  side: PendleConvertSide;
  marketAddress?: `0x${string}`;
  /** The token going IN to /convert (underlying for Buy, PT for Withdraw) */
  inputToken?: `0x${string}`;
  /** The token coming OUT of /convert (PT for Buy, underlying for Withdraw) */
  outputToken?: `0x${string}`;
  /** Input amount in wei */
  amountIn?: bigint;
  /** Slippage tolerance (decimal, e.g. 0.002 = 0.2%) */
  slippage: number;
  /**
   * Set ONLY when the market is matured. Included in the request as
   * `inputs[1]` with amount `0`; the API uses this as a marker to route to
   * `exitPostExpToToken` instead of `swapExactPtForToken`. Callers should
   * pass `market.ytToken` iff `isMarketMatured(market.expiry)`.
   */
  ytTokenForExit?: `0x${string}`;
  enabled?: boolean;
};

/**
 * Core quote hook. POSTs /v3/sdk/1/convert and shapes the result for
 * downstream useBatchPendleConvert.
 *
 * Our integration only adds mainnet markets to PENDLE_MARKETS, and Pendle's API
 * doesn't serve Tenderly fork chain IDs, so we always query mainnet regardless
 * of the connected chain.
 *
 * The returned quote intentionally drops the API's `tx.to` and `tx.data` — we
 * never sign them. We only keep:
 *   - `method` for the per-flow selector allowlist
 *   - `amountOut` for display
 *   - `apiMinOut` (extracted from the API's parsed args) — passed through as
 *     the on-chain min tolerance; extraction throws on missing/non-numeric so
 *     a malformed quote becomes a query error rather than a silent 0n
 *   - `apiContractParams` so buildVerifiedArgs can read the `guessPtOut` hint
 *   - APY / price-impact metrics for display
 */
export function useQuotePendleConvert({
  side,
  marketAddress,
  inputToken,
  outputToken,
  amountIn,
  slippage,
  ytTokenForExit,
  enabled: enabledParam = true
}: UseQuotePendleConvertParams): PendleQuoteHook {
  const { address: connectedAddress } = useConnection();

  const enabled =
    enabledParam &&
    !!marketAddress &&
    !!inputToken &&
    !!outputToken &&
    !!amountIn &&
    amountIn !== 0n &&
    !!connectedAddress;

  const { data, isLoading, error, refetch } = useQuery({
    enabled,
    queryKey: [
      'pendle-convert',
      marketAddress,
      side,
      inputToken,
      outputToken,
      amountIn,
      connectedAddress,
      slippage,
      ytTokenForExit
    ],
    queryFn: async (): Promise<PendleConvertQuote> => {
      const inputs: Array<{ token: `0x${string}`; amount: string }> = [
        { token: inputToken!, amount: amountIn!.toString() }
      ];
      if (ytTokenForExit) {
        // Matured-market exit: the API routes to `exitPostExpToToken` when YT
        // is included as a second input (with amount 0).
        inputs.push({ token: ytTokenForExit, amount: '0' });
      }
      const response = await fetchPendleConvert(mainnet.id, {
        receiver: connectedAddress!,
        slippage,
        inputs,
        outputs: [outputToken!],
        additionalData: 'impliedApy,effectiveApy'
      });

      const route = response.routes[0];
      const apiAmountOut = BigInt(route.outputs[0]?.amount ?? '0');
      const apiMinOut = extractApiMinOut(
        route.contractParamInfo.method,
        route.contractParamInfo.contractCallParams
      );

      return {
        method: route.contractParamInfo.method,
        amountOut: apiAmountOut,
        apiMinOut,
        effectiveApy: route.data.effectiveApy ?? 0,
        impliedApy: route.data.impliedApy?.after ?? route.data.impliedApy?.before ?? 0,
        priceImpact: route.data.priceImpact,
        fetchedAt: Date.now(),
        apiContractParams: route.contractParamInfo.contractCallParams,
        apiContractParamsName: route.contractParamInfo.contractCallParamsName
      };
    },
    staleTime: 30_000,
    gcTime: 60_000,
    refetchInterval: PENDLE_QUOTE_REFETCH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    retry: 1
  });

  return {
    data,
    isLoading,
    error,
    mutate: refetch,
    dataSources: [
      {
        title: 'Pendle SDK API (/convert)',
        href: 'https://api-v2.pendle.finance/core/docs',
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.TWO]
      }
    ]
  };
}
