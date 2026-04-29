import { mainnet } from 'wagmi/chains';
import { TENDERLY_CHAIN_ID } from '../constants';
import { PENDLE_API_BASE_URL } from './constants';

/**
 * Pendle's API does not serve Tenderly fork chain IDs. When running on a fork,
 * we hit the real mainnet API for quote calldata; the resulting tx still
 * executes on the fork because Tenderly mirrors mainnet state.
 */
function resolveApiChainId(chainId: number): number {
  if (chainId === TENDERLY_CHAIN_ID) return mainnet.id;
  return chainId;
}

// ---------------------------------------------------------------------------
// /v3/sdk/{chainId}/convert
// ---------------------------------------------------------------------------

export type PendleConvertRequest = {
  receiver: `0x${string}`;
  /** Decimal: 0.002 = 0.2% */
  slippage: number;
  inputs: Array<{ token: `0x${string}`; amount: string }>;
  outputs: Array<`0x${string}`>;
  additionalData?: string;
};

/**
 * The relevant fields we care about from /convert. Pendle returns a richer
 * response with several routes; we always read `routes[0]` (the recommended
 * route) and pluck what we need.
 */
export type PendleConvertRouteRaw = {
  contractParamInfo: {
    method: string;
    contractCallParamsName: string[];
    contractCallParams: unknown[];
  };
  tx: {
    to: `0x${string}`;
    data: `0x${string}`;
    from: `0x${string}`;
  };
  outputs: Array<{ token: `0x${string}`; amount: string }>;
  data: {
    aggregatorType: string;
    priceImpact: number;
    impliedApy?: { before: number; after: number };
    effectiveApy?: number;
    fee?: { usd: number };
  };
};

export type PendleConvertResponseRaw = {
  action: string;
  inputs: Array<{ token: `0x${string}`; amount: string }>;
  requiredApprovals: Array<{ token: `0x${string}`; amount: string }>;
  routes: PendleConvertRouteRaw[];
};

/**
 * POST /v3/sdk/{chainId}/convert
 *
 * Throws on non-2xx response or empty `routes` array. The caller is responsible
 * for the security pipeline (selector allowlist, decode + cross-check, override
 * matrix). This function only handles transport.
 */
export async function fetchPendleConvert(
  chainId: number,
  body: PendleConvertRequest,
  signal?: AbortSignal
): Promise<PendleConvertResponseRaw> {
  const apiChainId = resolveApiChainId(chainId);
  const url = `${PENDLE_API_BASE_URL}/v3/sdk/${apiChainId}/convert`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
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

// ---------------------------------------------------------------------------
// /v2/markets/all (filtered by ids)
// ---------------------------------------------------------------------------

/**
 * Per-market detail bag returned under `details`. Only the fields we actually
 * use are typed; the API includes many more (swapFeeApy, pendleApy,
 * ytFloatingApy, yieldRange, etc.) — add them here as needed.
 */
export type PendleMarketDetailsRaw = {
  liquidity?: number;
  totalTvl?: number;
  tradingVolume?: number;
  underlyingApy?: number;
  impliedApy?: number;
  swapFeeApy?: number;
};

/**
 * One entry in the `results` array. References to other tokens come back as
 * "<chainId>-<address>" strings (e.g. "1-0xb87511..."). `expiry` is an ISO
 * timestamp string.
 */
export type PendleMarketSummaryRaw = {
  name: string;
  address: `0x${string}`;
  expiry: string;
  pt: string;
  yt: string;
  sy: string;
  underlyingAsset: string;
  accountingAsset?: string;
  chainId: number;
  details: PendleMarketDetailsRaw;
  isNew?: boolean;
  isPrime?: boolean;
  timestamp?: string;
  categoryIds?: string[];
  isVolatile?: boolean;
};

export type PendleMarketsAllResponseRaw = {
  total: number;
  limit: number;
  skip: number;
  results: PendleMarketSummaryRaw[];
};

/**
 * GET /v2/markets/all?ids=<chainId>-<marketAddress>[,<chainId>-<marketAddress>...]
 *
 * Returns headline market data (implied APY, TVL). PENDLE_MARKETS holds the
 * static configuration (expiry, token addresses); this endpoint supplies the
 * volatile display values that aren't easily readable on-chain.
 */
export async function fetchPendleMarketsByIds(
  chainId: number,
  marketAddresses: `0x${string}`[],
  signal?: AbortSignal
): Promise<PendleMarketSummaryRaw[]> {
  if (marketAddresses.length === 0) return [];
  const apiChainId = resolveApiChainId(chainId);
  const ids = marketAddresses.map(a => `${apiChainId}-${a.toLowerCase()}`).join(',');
  const url = `${PENDLE_API_BASE_URL}/v2/markets/all?ids=${ids}`;

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Pendle /markets/all ${response.status}`);
  }
  const json = (await response.json()) as PendleMarketsAllResponseRaw;
  return json.results || [];
}
