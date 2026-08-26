import type { Intent } from '@/lib/enums';

/**
 * Risk tier vocabulary from the V2 Figma ("Earn Opportunities" filter pills).
 * TODO(BL-07): tiers are HARDCODED pending the risk-rating source decision
 * (editorial config vs endpoint). Assignments follow the risk sheet Kacper
 * posted on APP-396 (initial draft, 2026-07-20) — see RISK_TIER_BY_PROFILE.
 */
export type EarnRiskTier = 'low' | 'moderate' | 'advanced';

export type EarnProductKind = 'savings' | 'rewards' | 'vault' | 'fixed' | 'stusds';

/**
 * Key into the per-product risk content (tier + description + exposure facts,
 * APP-396). Finer-grained than `EarnProductKind` because products within a
 * family carry different assessments — the Flagship and Risk Capital Morpho
 * vaults sit in different tiers, and each rewards farm names its own reward.
 * 'rewards' is the generic fallback for a reward token without a profile of
 * its own yet. 'stake' is not an Earn product — it is the Stake module's
 * profile, keyed here so the Portfolio's "Earn with Sky" card draws the same
 * risk pill and details as the marketplace products.
 */
export type EarnRiskProfileId =
  | 'savings'
  | 'rewards'
  | 'rewards-sky'
  | 'rewards-spk'
  | 'rewards-grove'
  | 'rewards-cle'
  | 'vault-flagship'
  | 'vault-usdt-savings'
  | 'vault-tether-savings'
  | 'vault-risk-capital'
  | 'fixed'
  | 'stusds'
  | 'stake';

/**
 * USD-denominated amount aggregated across the active chain family, with a
 * per-chain split where the underlying source provides one (positions always
 * do; some TVL sources only report a global figure).
 */
export type EarnUsdAmount = {
  totalUsd: number;
  byChain?: Record<number, number>;
};

export type EarnRate = {
  /**
   * Decimal fraction (0.045 = 4.50%). Undefined while loading or when the
   * product has no APY (e.g. Chronicle points).
   */
  value?: number;
  /** Display string ('4.50%'), '—' when value is undefined. */
  formatted: string;
};

/**
 * Static, fetch-free identity of an earn product instance — one entry per
 * contract/market. The registry (buildEarnProducts) emits these; the
 * marketplace aggregator decorates them with live data.
 */
export type EarnProductDescriptor = {
  /** Stable identifier, e.g. 'savings', 'rewards-spk', 'vault-sky-0x…', 'fixed-0x…'. */
  id: string;
  kind: EarnProductKind;
  /** Module that owns the product (availability, network override, analytics). */
  intent: Intent;
  name: string;
  /** The product's display-asset symbol (Token column icon). */
  tokenSymbol: string;
  /** Symbols the user can supply into the product ("Supply:" icons, stablecoin filter). */
  supplyTokens: string[];
  risk: EarnRiskTier;
  /** Selects the product's risk tier + details copy (APP-396); `risk` above is derived from it. */
  riskProfile: EarnRiskProfileId;
  /**
   * Chains within the active family the product is live on. Derived from
   * static config (CHAIN_WIDGET_MAP ∩ per-product address maps) — never from
   * fetches, so network badges render before any data arrives.
   */
  networks: number[];
  /** In-app destination, built via the route contract (lib/routes) — never hardcoded. */
  detailPath: string;
  /** Pendle PT maturity (unix seconds); only set for kind 'fixed'. */
  maturity?: number;
  /** Chain-resolved contract identity for data lookups (reward contract, vault, market). */
  address?: `0x${string}`;
};

/** A descriptor decorated with live data — one table row. */
export type EarnProductRow = EarnProductDescriptor & {
  rate: EarnRate;
  /**
   * Trailing 30-day average rate, averaged over each product's daily historical
   * series (`trailingAverageRate`). Formats to '—' when the product has no
   * historical source data yet — a points farm, a market listed today.
   */
  rate30d: EarnRate;
  tvl?: EarnUsdAmount;
  position?: EarnUsdAmount;
  isLoading: boolean;
  error: Error | null;
};

export type EarnMarketplaceResult = {
  rows: EarnProductRow[];
  /** True while any row is still loading. Rows fail independently — check per-row error. */
  isLoading: boolean;
  /**
   * True while any source feeding `row.position` is still loading — a strict
   * subset of `isLoading` that excludes rate/TVL/chart history. Consumers that
   * only read positions (the landing sorter) settle on this much earlier than
   * on the full flag.
   */
  isPositionsLoading: boolean;
  /**
   * True when any source feeding `row.position` has errored. A failed source
   * settles as an empty position, indistinguishable from a genuinely empty
   * wallet — consumers that persist or act on the settled totals must skip
   * when this is set.
   */
  isPositionsError: boolean;
  /** Σ of every row's user position USD — the wallet's total deposited across all earn products. */
  totalDepositedUsd: number;
};
