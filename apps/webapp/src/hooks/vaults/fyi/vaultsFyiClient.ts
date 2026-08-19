import { VAULTS_FYI_API_URL } from './constants';

/**
 * Shared shape of both returns endpoints, from the official OpenAPI specs
 * (api.vaults.fyi/v2/documentation/json + /beta/documentation/json,
 * 2026-08-19). `returnsNative` is documented only as "total returns in native
 * token amount"; the response carrying `decimals` (and sibling vault fields
 * being "denominated in asset wei") points to base units, but NO live fixture
 * exists yet (key-gated) — the compute layer hard-gates the parse and
 * degrades on any surprise. Goldens land at QA once the key exists.
 */
export type VaultsFyiReturnsRaw = {
  /** Asset (underlying token) address, NOT the vault address. */
  address?: string;
  assetCaip?: string;
  name?: string;
  symbol?: string;
  decimals?: number;
  assetLogo?: string;
  /** Optional in the spec — its absence degrades the USD figure. */
  assetPriceInUsd?: string;
  assetGroup?: string;
  /** Presumed base-unit integer string (see doc block above). */
  returnsNative?: string;
};

/** Partial-returns adds the resolved period boundaries (unix seconds). */
export type VaultsFyiPartialReturnsRaw = VaultsFyiReturnsRaw & {
  fromTimestamp?: number;
  toTimestamp?: number;
};

async function getJson<T>(url: string, label: string): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!response.ok) {
    throw new Error(`vaults.fyi ${label} ${response.status}`);
  }
  return (await response.json()) as T;
}

/**
 * GET /v2/portfolio/total-returns/{user}/mainnet/{vaultId}
 *
 * Lifetime earned yield for one position, server-computed. The /mainnet/
 * segment is hardcoded: APP-450 earnings are mainnet-only scope.
 */
export async function fetchVaultsFyiTotalReturns({
  userAddress,
  vaultId
}: {
  userAddress: string;
  vaultId: string;
}): Promise<VaultsFyiReturnsRaw> {
  return getJson(
    `${VAULTS_FYI_API_URL}/v2/portfolio/total-returns/${userAddress.toLowerCase()}/mainnet/${vaultId.toLowerCase()}`,
    '/total-returns'
  );
}

/**
 * GET /beta/portfolio/partial-returns/{user}/mainnet/{vaultId}?fromTimestamp=…
 *
 * Returns over a window starting at `fromTimestamp` (unix seconds); no
 * toTimestamp is sent — the API default (now) is the month-to-date window end.
 * Beta endpoint: any failure or shape drift degrades, never partial-sums.
 */
export async function fetchVaultsFyiPartialReturns({
  userAddress,
  vaultId,
  fromTimestamp
}: {
  userAddress: string;
  vaultId: string;
  fromTimestamp: number;
}): Promise<VaultsFyiPartialReturnsRaw> {
  return getJson(
    `${VAULTS_FYI_API_URL}/beta/portfolio/partial-returns/${userAddress.toLowerCase()}/mainnet/${vaultId.toLowerCase()}?fromTimestamp=${fromTimestamp}`,
    '/partial-returns'
  );
}
