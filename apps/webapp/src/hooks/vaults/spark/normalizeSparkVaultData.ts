import { parseUnits } from 'viem';
import type { MorphoVaultRateData } from '../../morpho/useMorphoVaultRateApiData';
import type {
  NormalizedVaultAllocation,
  NormalizedVaultHistoryPoint,
  NormalizedVaultMarketData
} from '../useVaultMarketData';
import type {
  SparkSavingsCollateralComposition,
  SparkSavingsCurrentResponse,
  SparkSavingsHistoricResponse,
  SparkSavingsLiquidityEntry
} from './sparkSavingsApi';

/** Asset decimals fallback when the payload omits the `asset` descriptor. */
const DEFAULT_ASSET_DECIMALS = 18;

function formatRate(apy: number): string {
  return `${(apy * 100).toFixed(2)}%`;
}

/**
 * Parse a decimal-string amount in whole-token units (e.g. `"101.3251"`) into the
 * smallest unit with the given decimals. Excess fractional digits are truncated
 * (the API returns up to ~25 fractional places) so `parseUnits` never rejects a
 * high-precision string. Returns undefined on empty/garbage input.
 */
function parseTokenAmount(value: string | undefined, decimals: number): bigint | undefined {
  if (value === undefined || value === null) return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;

  const [whole, fraction = ''] = trimmed.split('.');
  let normalized = trimmed;
  if (fraction.length > decimals) {
    normalized = decimals > 0 ? `${whole}.${fraction.slice(0, decimals)}` : whole;
  }

  try {
    return parseUnits(normalized, decimals);
  } catch {
    return undefined;
  }
}

/** Parse the string `apy` (a decimal fraction, e.g. `"0.0365"`) to a number. */
function parseApy(apy: string | undefined): number | undefined {
  if (apy === undefined || apy === null) return undefined;
  const trimmed = apy.trim();
  if (trimmed === '') return undefined;
  const parsed = Number.parseFloat(trimmed);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function normalizeRate(apy: number | undefined, vaultAddress: string): MorphoVaultRateData | undefined {
  if (apy === undefined || Number.isNaN(apy)) return undefined;
  // Spark surfaces a single net APY; no fee split is exposed, so gross == net and
  // the fee fields are a truthful 0%.
  return {
    address: vaultAddress,
    rate: apy,
    netRate: apy,
    managementFee: 0,
    performanceFee: 0,
    formattedRate: formatRate(apy),
    formattedNetRate: formatRate(apy),
    formattedManagementFee: '0%',
    formattedPerformanceFee: '0%',
    rewards: []
  };
}

/** Sum the vault-level liquidity sources into a single available-liquidity figure. */
function normalizeLiquidity(
  liquidity: SparkSavingsLiquidityEntry[] | undefined,
  decimals: number
): bigint | undefined {
  if (!Array.isArray(liquidity) || liquidity.length === 0) return undefined;

  let total = 0n;
  let any = false;
  for (const entry of liquidity) {
    const value = parseTokenAmount(entry?.value, decimals);
    if (value === undefined) continue;
    total += value;
    any = true;
  }

  return any ? total : undefined;
}

/**
 * Flatten `collateralComposition` (collateral symbol → `[{category, value}]`,
 * values in absolute whole-token units) into normalized allocations. Zero/garbage
 * buckets are dropped, same-category buckets are summed, and the share is computed
 * against TVL.
 */
function normalizeAllocations(
  collateralComposition: SparkSavingsCollateralComposition | undefined,
  decimals: number,
  totalAssets: bigint | undefined
): NormalizedVaultAllocation[] | undefined {
  if (!collateralComposition || typeof collateralComposition !== 'object') return undefined;

  const byCategory = new Map<string, bigint>();
  const order: string[] = [];

  for (const entries of Object.values(collateralComposition)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const assets = parseTokenAmount(entry?.value, decimals);
      // Drop unparseable and zero buckets so Exposure shows only real allocations.
      if (assets === undefined || assets <= 0n) continue;
      const name = entry.category;
      if (!byCategory.has(name)) order.push(name);
      byCategory.set(name, (byCategory.get(name) ?? 0n) + assets);
    }
  }

  if (order.length === 0) return undefined;

  return order.map(name => {
    const assets = byCategory.get(name) as bigint;
    return {
      name,
      assets,
      allocationPercent:
        totalAssets !== undefined && totalAssets > 0n ? Number(assets) / Number(totalAssets) : undefined
    };
  });
}

/**
 * Map a raw current Spark Savings payload into the provider-neutral normalized
 * shape consumed by `useVaultMarketData`.
 *
 * Defensive: unwraps the `data` envelope, tolerates missing/empty fields, and
 * returns undefined (a clean empty state) rather than throwing when there is
 * nothing usable. Replaces the placeholder `normalizeSparkVaultPayload`.
 */
export function normalizeSparkCurrentData(
  response: SparkSavingsCurrentResponse | null | undefined,
  vaultAddress: string
): NormalizedVaultMarketData | undefined {
  const data = response?.data;
  if (!data) return undefined;

  const decimals = data.asset?.decimals ?? DEFAULT_ASSET_DECIMALS;

  const totalAssets = parseTokenAmount(data.tvl, decimals);
  const rate = normalizeRate(parseApy(data.apy), vaultAddress);
  const liquidity = normalizeLiquidity(data.liquidity, decimals);
  const allocations = normalizeAllocations(data.collateralComposition, decimals, totalAssets);
  const depositCap = parseTokenAmount(data.depositCap, decimals);

  if (
    rate === undefined &&
    totalAssets === undefined &&
    liquidity === undefined &&
    allocations === undefined &&
    depositCap === undefined
  ) {
    return undefined;
  }

  return {
    rate,
    totalAssets,
    liquidity,
    allocations,
    depositCap
  };
}

/**
 * Map the raw historic Spark Savings payload (daily `{date, apy, tvl}` points)
 * into the provider-neutral history-point series the metrics chart consumes.
 *
 * `date` (ISO UTC-midnight) → `blockTimestamp` (unix seconds); `tvl` (decimal
 * string, whole-token units) → `amount` via the asset decimals; `apy` (decimal
 * string) → a decimal rate. The API exposes no USD figure, so `amountUsd` is 0.
 * Points are returned ascending by timestamp.
 *
 * Defensive: unwraps the `data` array, drops entries with an unparseable date or
 * TVL, and yields an empty (not errored) series for an empty/missing payload.
 */
export function normalizeSparkHistoricData(
  response: SparkSavingsHistoricResponse | null | undefined,
  decimals: number = DEFAULT_ASSET_DECIMALS
): NormalizedVaultHistoryPoint[] {
  const entries = response?.data;
  if (!Array.isArray(entries) || entries.length === 0) return [];

  const points: NormalizedVaultHistoryPoint[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry.date !== 'string') continue;
    const ms = Date.parse(entry.date);
    if (Number.isNaN(ms)) continue;
    const amount = parseTokenAmount(entry.tvl, decimals);
    if (amount === undefined) continue;
    points.push({
      blockTimestamp: Math.floor(ms / 1000),
      amount,
      amountUsd: 0,
      apy: parseApy(entry.apy)
    });
  }

  points.sort((a, b) => a.blockTimestamp - b.blockTimestamp);
  return points;
}
