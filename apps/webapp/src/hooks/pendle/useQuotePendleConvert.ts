import { useQuery } from '@tanstack/react-query';
import { isAddressEqual } from 'viem';
import { useConnection } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { TRUST_LEVELS, TrustLevelEnum, ZERO_ADDRESS } from '../constants';
import { PENDLE_QUOTE_REFETCH_MS, PendleConvertSide } from './constants';
import type { PendleAggregatorRoute, PendleConvertQuote, PendleQuoteHook } from './pendle';
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

/**
 * Pull the aggregator route (`pendleSwap` + `swapData`) out of the API's
 * parsed contract params. Returns `undefined` if the route is the default
 * no-aggregator path (`pendleSwap = 0x0` and empty swapData).
 *
 * Position depends on the method:
 *   - swapExactTokenForPt: input struct at params[4]
 *   - swapExactPtForToken: output struct at params[3]
 *   - exitPostExpToToken: output struct at params[4] (matured-redeem path may
 *     route through the aggregator when the user picks USDS/USDC instead of
 *     the underlying)
 *
 * Throws on a malformed shape so a tampered quote becomes a query error
 * instead of silently producing a bad signing payload.
 */
function extractAggregatorRoute(method: string, params: unknown[]): PendleAggregatorRoute | undefined {
  // Pendle's API returns numeric fields as decimal strings (JSON has no
  // native bigint / uint8). `swapType` arrives as e.g. "1", not 1 — we coerce
  // here. Other numeric scalars in the contract args follow the same shape;
  // see extractApiMinOut for the precedent.
  type RawSwapData = {
    swapType?: number | string;
    extRouter?: `0x${string}`;
    extCalldata?: `0x${string}`;
    needScale?: boolean;
  };
  type RawSlot = { pendleSwap?: `0x${string}`; swapData?: RawSwapData };

  let slot: RawSlot | undefined;
  if (method === 'swapExactTokenForPt') {
    slot = params[4] as RawSlot | undefined;
  } else if (method === 'swapExactPtForToken') {
    slot = params[3] as RawSlot | undefined;
  } else if (method === 'exitPostExpToToken') {
    slot = params[4] as RawSlot | undefined;
  } else {
    return undefined;
  }

  if (!slot || typeof slot !== 'object') {
    throw new Error(`Pendle: malformed quote — missing input/output struct for "${method}"`);
  }

  const pendleSwap = slot.pendleSwap;
  const swapData = slot.swapData;

  // No-aggregator route: API returns ZERO_ADDRESS / empty swapData.
  if (!pendleSwap || isAddressEqual(pendleSwap, ZERO_ADDRESS)) {
    return undefined;
  }

  const swapTypeRaw = swapData?.swapType;
  const swapTypeNum =
    typeof swapTypeRaw === 'number'
      ? swapTypeRaw
      : typeof swapTypeRaw === 'string' && /^\d+$/.test(swapTypeRaw)
        ? Number(swapTypeRaw)
        : NaN;

  if (
    !swapData ||
    !Number.isFinite(swapTypeNum) ||
    !swapData.extRouter ||
    typeof swapData.extCalldata !== 'string' ||
    typeof swapData.needScale !== 'boolean'
  ) {
    throw new Error(
      `Pendle: malformed quote — pendleSwap is set but swapData is missing/invalid for "${method}"`
    );
  }

  return {
    pendleSwap,
    swapData: {
      swapType: swapTypeNum,
      extRouter: swapData.extRouter,
      extCalldata: swapData.extCalldata,
      needScale: swapData.needScale
    }
  };
}

type UseQuotePendleConvertParams = {
  side: PendleConvertSide;
  marketAddress?: `0x${string}`;
  /** The token going IN to /convert (user-selected for Buy, PT for Withdraw / matured-exit) */
  inputToken?: `0x${string}`;
  /** The token coming OUT of /convert (PT for Buy, user-selected for Withdraw / matured-exit) */
  outputToken?: `0x${string}`;
  /**
   * The market's underlying token (the one the SY accepts directly). Used to
   * decide whether to ask the API for an aggregator route: when the user's
   * non-PT-side token differs from the underlying, we set
   * `enableAggregator: true` and the API may return a KyberSwap / Odos / OKX /
   * Paraswap hop wrapped via Pendle's PendleSwap forwarder.
   */
  underlyingToken?: `0x${string}`;
  /** Input amount in wei */
  amountIn?: bigint;
  /** Slippage tolerance (decimal, e.g. 0.002 = 0.2%) */
  slippage: number;
  enabled?: boolean;
  /**
   * Matured-market exit. When true, the API's `inputs` is sent as a two-entry
   * array: PT with `amountIn`, plus the YT with `amount: 0`. Pendle's /convert
   * endpoint requires both entries for `exitPostExpToToken` quotes (the
   * matured-exit math operates over the PT/YT pair even though only PT moves).
   * The corresponding YT address is required when this is set.
   */
  maturedExit?: boolean;
  /** YT token address — required when `maturedExit` is true. */
  ytToken?: `0x${string}`;
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
  underlyingToken,
  amountIn,
  slippage,
  enabled: enabledParam = true,
  maturedExit = false,
  ytToken
}: UseQuotePendleConvertParams): PendleQuoteHook {
  const { address: connectedAddress } = useConnection();

  const enabled =
    enabledParam &&
    !!marketAddress &&
    !!inputToken &&
    !!outputToken &&
    !!underlyingToken &&
    !!amountIn &&
    amountIn !== 0n &&
    !!connectedAddress &&
    (!maturedExit || !!ytToken);

  // Aggregator is needed iff the user's non-PT-side token differs from the
  // SY's accepted (underlying) token. PT itself is never the underlying, so
  // we look at the input on Buy and the output on Withdraw.
  const nonPtToken = side === PendleConvertSide.BUY ? inputToken : outputToken;
  const enableAggregator = !!nonPtToken && !!underlyingToken && !isAddressEqual(nonPtToken, underlyingToken);

  const { data, isLoading, error, refetch } = useQuery({
    enabled,
    queryKey: [
      'pendle-convert',
      marketAddress,
      side,
      inputToken,
      outputToken,
      underlyingToken,
      enableAggregator,
      maturedExit,
      ytToken,
      // React Query hashes the queryKey via JSON.stringify, which throws on
      // BigInt values. Serialize amountIn to string so the cache key is stable
      // and unique without crashing the renderer.
      amountIn?.toString(),
      connectedAddress,
      slippage
    ],
    queryFn: async (): Promise<PendleConvertQuote> => {
      // Matured-exit: Pendle's /convert requires the PT/YT pair as inputs even
      // though only PT moves. YT goes in with `amount: 0` — without this entry
      // the API rejects the request for `exitPostExpToToken` quotes.
      const inputs: Array<{ token: `0x${string}`; amount: string }> = maturedExit
        ? [
            { token: inputToken!, amount: amountIn!.toString() },
            { token: ytToken!, amount: '0' }
          ]
        : [{ token: inputToken!, amount: amountIn!.toString() }];
      const response = await fetchPendleConvert(mainnet.id, {
        receiver: connectedAddress!,
        slippage,
        inputs,
        outputs: [outputToken!],
        additionalData: 'impliedApy,effectiveApy',
        ...(enableAggregator ? { enableAggregator: true } : {})
      });

      const route = response.routes[0];
      const apiAmountOut = BigInt(route.outputs[0]?.amount ?? '0');
      const apiMinOut = extractApiMinOut(
        route.contractParamInfo.method,
        route.contractParamInfo.contractCallParams
      );
      const aggregatorRoute = extractAggregatorRoute(
        route.contractParamInfo.method,
        route.contractParamInfo.contractCallParams
      );
      const breakdownRaw = route.data.priceImpactBreakDown;
      const priceImpactBreakdown =
        breakdownRaw &&
        typeof breakdownRaw.internalPriceImpact === 'number' &&
        typeof breakdownRaw.externalPriceImpact === 'number'
          ? {
              internalPriceImpact: breakdownRaw.internalPriceImpact,
              externalPriceImpact: breakdownRaw.externalPriceImpact
            }
          : undefined;

      return {
        method: route.contractParamInfo.method,
        amountOut: apiAmountOut,
        apiMinOut,
        effectiveApy: route.data.effectiveApy ?? 0,
        impliedApy: route.data.impliedApy?.after ?? route.data.impliedApy?.before ?? 0,
        priceImpact: route.data.priceImpact,
        priceImpactBreakdown,
        aggregatorType: aggregatorRoute ? route.data.aggregatorType : undefined,
        aggregatorRoute,
        feeUsd: route.data.fee?.usd,
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
