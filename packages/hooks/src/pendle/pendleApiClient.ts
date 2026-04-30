import { mainnet } from 'wagmi/chains';
import { TENDERLY_CHAIN_ID } from '../constants';
import { PENDLE_API_BASE_URL } from './constants';
import type {
  PendleConvertRequest,
  PendleConvertResponseRaw,
  PendleMarketSummaryRaw,
  PendleMarketsAllResponseRaw
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
export async function fetchPendleConvert(
  chainId: number,
  body: PendleConvertRequest
): Promise<PendleConvertResponseRaw> {
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
