import { mainnet } from 'wagmi/chains';
import { TENDERLY_CHAIN_ID } from '../constants';
import { PENDLE_API_BASE_URL } from './constants';
import type {
  PendleConvertRequest,
  PendleConvertResponseRaw,
  PendleMarketSummaryRaw,
  PendleMarketsAllResponseRaw,
  PendlePnlTransactionRaw,
  PendlePnlTransactionsResponseRaw
} from './pendle';

/**
 * Pendle's API does not serve Tenderly fork chain IDs. When running on a fork,
 * we hit the real mainnet API for quote calldata; the resulting tx still
 * executes on the fork because Tenderly mirrors mainnet state.
 */
function resolveApiChainId(chainId: number): number {
  if (chainId === TENDERLY_CHAIN_ID) return mainnet.id;
  return chainId;
}

/**
 * POST /v3/sdk/{chainId}/convert
 *
 * Throws on non-2xx response or empty `routes` array. The caller is responsible
 * for the security pipeline (selector allowlist, decode + cross-check, override
 * matrix). This function only handles transport.
 */
// DEMO BRANCH — DO NOT MERGE: the demo fakes maturity on a live market, so
// the real API would quote a pre-expiry market sell (at a discount, via a
// method the security allowlist rejects). Synthesize the par-redemption
// response a genuinely matured market would return instead.
const DEMO_ZERO = '0x0000000000000000000000000000000000000000' as `0x${string}`;
const DEMO_MARKET = '0x9c560ebaf78e596cbcc27411d633a74d628dd7dc' as `0x${string}`;
// PT par value is 1 USDS at maturity; sUSDS output is scaled by the ~1.06
// share rate; USDC drops 12 decimal places.
const DEMO_OUTPUT_RATES: Record<string, { num: bigint; den: bigint }> = {
  '0xdc035d45d973e3ec169d2276ddab16f1e407384f': { num: 1n, den: 1n }, // USDS
  '0x6b175474e89094c44da98b954eedeac495271d0f': { num: 1n, den: 1n }, // DAI
  '0xa3931d71877c0e7a3148cb7eb4463524fec27fbd': { num: 943n, den: 1000n }, // sUSDS
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { num: 1n, den: 10n ** 12n } // USDC
};

// Tokens the SY accepts directly; anything else (USDC) exits via SY→USDS then
// an external aggregator hop, mirroring what the real matured exit would do.
const DEMO_SY_ACCEPTED = new Set([
  '0xdc035d45d973e3ec169d2276ddab16f1e407384f', // USDS
  '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
  '0xa3931d71877c0e7a3148cb7eb4463524fec27fbd' // sUSDS
]);
const DEMO_USDS = '0xdC035D45d973E3EC169d2276DDab16f1e407384F' as `0x${string}`;
const DEMO_PENDLE_SWAP = '0xd4f480965d2347d421f1bec7f545682e5ec2151d' as `0x${string}`;
const DEMO_KYBER_ROUTER = '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5' as `0x${string}`;

function demoMaturedExitResponse(body: PendleConvertRequest): PendleConvertResponseRaw {
  const ptIn = body.inputs[0];
  const outToken = body.outputs[0];
  const rate = DEMO_OUTPUT_RATES[outToken.toLowerCase()] ?? { num: 1n, den: 1n };
  const amountOut = (BigInt(ptIn.amount) * rate.num) / rate.den;
  const slippageBps = BigInt(Math.round(body.slippage * 10_000));
  const minOut = (amountOut * (10_000n - slippageBps)) / 10_000n;
  const viaAggregator = !DEMO_SY_ACCEPTED.has(outToken.toLowerCase());
  const output = {
    tokenOut: outToken,
    minTokenOut: minOut.toString(),
    tokenRedeemSy: viaAggregator ? DEMO_USDS : outToken,
    pendleSwap: viaAggregator ? DEMO_PENDLE_SWAP : DEMO_ZERO,
    swapData: {
      swapType: viaAggregator ? '1' : '0',
      extRouter: viaAggregator ? DEMO_KYBER_ROUTER : DEMO_ZERO,
      extCalldata: '0x',
      needScale: false
    }
  };
  return {
    action: 'exit-market',
    inputs: body.inputs,
    requiredApprovals: [{ token: ptIn.token, amount: ptIn.amount }],
    routes: [
      {
        contractParamInfo: {
          method: 'exitPostExpToToken',
          contractCallParamsName: ['receiver', 'market', 'netPtIn', 'netLpIn', 'output'],
          contractCallParams: [body.receiver, DEMO_MARKET, ptIn.amount, '0', output]
        },
        tx: { to: DEMO_MARKET, data: '0x', from: body.receiver },
        outputs: [{ token: outToken, amount: amountOut.toString() }],
        data: {
          aggregatorType: viaAggregator ? 'KYBERSWAP' : 'pendle',
          priceImpact: viaAggregator ? -0.0002 : 0,
          ...(viaAggregator
            ? {
                priceImpactBreakDown: { internalPriceImpact: -0.00012, externalPriceImpact: -0.00008 },
                fee: { usd: 2.47 }
              }
            : {})
          // No effectiveApy: the real API omits it for matured exits, so the
          // Effective APY row hides — matching genuine post-maturity behavior.
        }
      }
    ]
  };
}

export async function fetchPendleConvert(
  chainId: number,
  body: PendleConvertRequest
): Promise<PendleConvertResponseRaw> {
  // DEMO BRANCH — DO NOT MERGE: matured-exit requests carry the YT-with-zero
  // entry; intercept them and serve the synthetic matured-redemption quote.
  if (body.inputs.length === 2 && body.inputs[1]?.amount === '0') {
    return demoMaturedExitResponse(body);
  }
  const apiChainId = resolveApiChainId(chainId);
  const url = `${PENDLE_API_BASE_URL}/v3/sdk/${apiChainId}/convert`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    let detail = '';
    try {
      detail = JSON.stringify(await response.json());
    } catch {
      // ignore
    }
    throw new Error(`Pendle /convert ${response.status}: ${detail}`);
  }

  const json = (await response.json()) as PendleConvertResponseRaw;
  if (!json.routes || json.routes.length === 0) {
    throw new Error('Pendle /convert returned no routes');
  }
  return json;
}

/**
 * GET /v2/markets/all?ids=<chainId>-<marketAddress>[,<chainId>-<marketAddress>...]
 *
 * Returns headline market data (implied APY, TVL). PENDLE_MARKETS holds the
 * static configuration (expiry, token addresses); this endpoint supplies the
 * volatile display values that aren't easily readable on-chain.
 */
export async function fetchPendleMarketsByIds(
  chainId: number,
  marketAddresses: `0x${string}`[]
): Promise<PendleMarketSummaryRaw[]> {
  if (marketAddresses.length === 0) return [];
  const apiChainId = resolveApiChainId(chainId);
  const ids = marketAddresses.map(a => `${apiChainId}-${a.toLowerCase()}`).join(',');
  const url = `${PENDLE_API_BASE_URL}/v2/markets/all?ids=${ids}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Pendle /markets/all ${response.status}`);
  }
  const json = (await response.json()) as PendleMarketsAllResponseRaw;
  return json.results || [];
}

/**
 * GET /v1/pnl/transactions?user=<u>&chainId=<id>&limit=<n>
 *
 * Returns every PnL-affecting action the user has performed across every
 * Pendle market on the chain (mintPy, buyPt, sellPt, redeemPy, …). The single
 * unfiltered call is Pendle's "recommended way to fetch data" and is the only
 * endpoint we use for history — one request, flat 8 compute units, regardless
 * of how many markets we care about. Callers filter client-side to the
 * markets we support and the actions we surface.
 *
 * Docs: https://api-v2.pendle.finance/core/docs#tag/pnl/get/v1/pnl/transactions
 * (operationId TransactionsController_getTransactions, 8 compute units).
 *
 * Cache: limit defaults to the API's max (1000). Pagination via `skip` is
 * unimplemented — no expected user has >1000 PnL events; revisit if a real
 * user hits the cap.
 *
 * Lag: the PnL feed lags chain tip by ~20s empirically (n=2, May 2026 —
 * Pendle's docs claim "few minutes" but the observed lag is much tighter).
 * Fresh trades appear only after the indexer catches up; PendleWidgetPane
 * fires a delayed refresh after tx success to surface the new row.
 */
export async function fetchPendlePnlTransactionsForUser(
  userAddress: `0x${string}`,
  { chainId = mainnet.id, limit = 1000 }: { chainId?: number; limit?: number } = {}
): Promise<PendlePnlTransactionRaw[]> {
  const apiChainId = resolveApiChainId(chainId);
  const params = new URLSearchParams({
    user: userAddress.toLowerCase(),
    chainId: String(apiChainId),
    limit: String(limit)
  });
  const url = `${PENDLE_API_BASE_URL}/v1/pnl/transactions?${params.toString()}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Pendle /pnl/transactions ${response.status}`);
  }
  const json = (await response.json()) as PendlePnlTransactionsResponseRaw;
  return json.results || [];
}
