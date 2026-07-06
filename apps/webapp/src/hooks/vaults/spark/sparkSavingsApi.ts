import { SPARK_SAVINGS_API_HOST } from './constants';

/** Token descriptor (`vault`/`asset`) as the Spark Savings API returns it. */
export type SparkSavingsTokenInfo = {
  address: string;
  decimals: number;
  symbol: string;
  name: string;
};

/** One vault-level liquidity source; `value` is a decimal string in whole-token units. */
export type SparkSavingsLiquidityEntry = {
  protocol: string;
  value: string;
};

/** One collateral-composition bucket; `value` is a decimal string in whole-token units. */
export type SparkSavingsCollateralEntry = {
  category: string;
  value: string;
};

/** Collateral composition keyed by collateral symbol (e.g. `usdt`, `usds`). */
export type SparkSavingsCollateralComposition = Record<string, SparkSavingsCollateralEntry[]>;

/**
 * The `data` envelope of the current Savings endpoint
 * (`/v1/savings/{protocol}/{chain}/{token}`). Every field is optional so the
 * normalizer can degrade cleanly against a dormant/partial vault.
 *
 * Note the quirks (see normalizer): `apy`/`tvl`/`depositCap` are decimal STRINGS;
 * `liquidity` is an array to sum; `collateralComposition` values are absolute
 * whole-token amounts, not fractions.
 */
export type SparkSavingsCurrentData = {
  vault?: SparkSavingsTokenInfo;
  asset?: SparkSavingsTokenInfo;
  apy?: string;
  tvl?: string;
  users?: number;
  depositCap?: string;
  liquidity?: SparkSavingsLiquidityEntry[];
  collateralComposition?: SparkSavingsCollateralComposition;
};

/** Top-level current response — everything is wrapped in a `data` envelope. */
export type SparkSavingsCurrentResponse = {
  data?: SparkSavingsCurrentData;
};

/**
 * One daily point of the historic Savings endpoint (`…/historic`). Daily only —
 * no intraday, no USD field. `apy`/`tvl` are decimal STRINGS like the current
 * endpoint; `date` is an ISO UTC-midnight string.
 */
export type SparkSavingsHistoricEntry = {
  date: string;
  apy?: string;
  tvl?: string;
};

/** Top-level historic response — a `data` array of daily points (may be empty). */
export type SparkSavingsHistoricResponse = {
  data?: SparkSavingsHistoricEntry[];
};

/** Path identity for a Savings vault: `/{protocol}/{chain}/{token}`. */
export type SparkVaultIdentity = {
  protocol: string;
  chain: string;
  token: string;
};

/**
 * Build a Savings API URL for the vault from its `token` segment.
 *
 * Points at our own edge-cached proxy (`SPARK_SAVINGS_API_HOST`, env-driven):
 * the route is `/vaults/savings/{token}`, with protocol+chain baked in
 * server-side. The proxy returns Spark's payload verbatim, so the normalizer,
 * hook, and UI are untouched. `historic: true` appends `/historic` (consumed by
 * the metrics-chart slice). `host` overrides the origin (used in tests).
 */
export function buildSparkSavingsUrl(
  identity: SparkVaultIdentity,
  options: { host?: string; historic?: boolean } = {}
): string {
  const host = (options.host ?? SPARK_SAVINGS_API_HOST).replace(/\/+$/, '');
  const { token } = identity;
  const base = `${host}/vaults/savings/${token}`;
  return options.historic ? `${base}/historic` : base;
}

/**
 * Fetch the current Savings payload for a vault. Public, read-only, no auth.
 * Throws on a non-OK response so the hook surfaces a clean error state.
 */
export async function fetchSparkSavingsCurrent(
  identity: SparkVaultIdentity,
  host?: string
): Promise<SparkSavingsCurrentResponse> {
  const url = buildSparkSavingsUrl(identity, { host });
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Spark Savings API error: ${response.status}`);
  }

  return (await response.json()) as SparkSavingsCurrentResponse;
}

/**
 * Fetch the historic (daily TVL/APY series) Savings payload for a vault. Reuses
 * the same configurable host as the current endpoint. Public, read-only, no auth.
 * Throws on a non-OK response so the caller can surface a clean error state.
 */
export async function fetchSparkSavingsHistoric(
  identity: SparkVaultIdentity,
  host?: string
): Promise<SparkSavingsHistoricResponse> {
  const url = buildSparkSavingsUrl(identity, { host, historic: true });
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Spark Savings API error: ${response.status}`);
  }

  return (await response.json()) as SparkSavingsHistoricResponse;
}
