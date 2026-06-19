import type { Intent } from '@/lib/enums';

/**
 * Risk tier vocabulary from the V2 Figma ("Earn Opportunities" filter pills).
 * TODO(BL-07): tiers are HARDCODED pending the risk-rating source decision
 * (editorial config vs endpoint). Per product decision 2026-06-12: 'moderate'
 * for every product, 'advanced' for stUSDS. 'low' is currently unassigned —
 * Sky Savings is the natural candidate once ratings get a real source.
 */
export type EarnRiskTier = 'low' | 'moderate' | 'advanced';

export type EarnProductKind = 'savings' | 'rewards' | 'vault' | 'fixed' | 'stusds';

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
   * TODO(C1 follow-up): no 30-day-rate source is wired yet (needs the
   * historical-rate endpoints) — always undefined; consumers render '–'.
   */
  rate30d?: EarnRate;
  tvl?: EarnUsdAmount;
  position?: EarnUsdAmount;
  isLoading: boolean;
  error: Error | null;
};

export type EarnMarketplaceResult = {
  rows: EarnProductRow[];
  /** True while any row is still loading. Rows fail independently — check per-row error. */
  isLoading: boolean;
  /** Σ of every row's user position USD — the wallet's total deposited across all earn products. */
  totalDepositedUsd: number;
};
