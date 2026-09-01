import type { EarnProductRow } from '@/hooks';
import { FALLBACK_TOKEN_COLOR, resolveTokenChartColors } from '@/widgets/shared/constants';

/**
 * Stablecoins surfaced in the Portfolio "Idle" tab (wallet holdings sitting
 * outside any earn product), with the full display name shown beside the symbol
 * in the legend. The registry `name` field only holds the short symbol, so the
 * display names live here. Symbols match `TOKENS[*].symbol`.
 */
export const IDLE_STABLECOINS = [
  { symbol: 'USDS', name: 'Sky USD' },
  { symbol: 'USDC', name: 'USD Coin' },
  { symbol: 'USDT', name: 'Tether USD' },
  { symbol: 'DAI', name: 'Dai Stablecoin' }
] as const;

/**
 * "1:1 [token]" peg badge per idle stablecoin — the 1:1 conversion product the
 * user can route through (USDS↔USDC via the PSM, DAI→USDS via the upgrade).
 * USDT has no 1:1 product, so it gets no badge.
 */
export const STABLECOIN_PEG_BADGE: Record<string, string> = {
  USDS: '1:1 USDC',
  USDC: '1:1 USDS',
  DAI: '1:1 USDS'
};

/** One stablecoin balance on one chain, in token units and valued in USD. Emitted by the hook. */
export type StablecoinBalance = {
  symbol: string;
  chainId: number;
  /** Balance in token units (e.g. 1000.5 USDC). */
  amount: number;
  amountUsd: number;
};

/** A stablecoin aggregated across the in-scope chains, decorated for display. */
export type IdleToken = {
  symbol: string;
  /** Full display name, e.g. 'Sky USD'. */
  name: string;
  /** Balance in token units, summed across the in-scope chains. */
  amount: number;
  amountUsd: number;
  /** Brand color (donut segment + legend swatch). */
  color: string;
  /** Hovered-segment color (DS Components/Charts-Hover). */
  hoverColor: string;
  /** Share of the wallet balance, 0..1. */
  share: number;
};

export type IdleView = {
  /** Tokens with a positive balance, sorted by amount descending. */
  tokens: IdleToken[];
  /** Total idle stablecoin value in scope (USD). */
  walletBalance: number;
  /** Count of distinct stablecoins held (= tokens.length). */
  idleCount: number;
};

const EMPTY_VIEW: IdleView = { tokens: [], walletBalance: 0, idleCount: 0 };

const NAME_BY_SYMBOL = new Map<string, string>(IDLE_STABLECOINS.map(s => [s.symbol, s.name]));

/**
 * Aggregates per-chain stablecoin balances into the Portfolio "Idle" overview,
 * scoped to a single chain or the whole family. Pure — no hooks, no fetching.
 *
 * @param network a chain id to scope to, or `'all'` for every chain.
 */
export function buildIdleView(balances: StablecoinBalance[], network: number | 'all'): IdleView {
  if (balances.length === 0) return EMPTY_VIEW;

  const inScope = network === 'all' ? balances : balances.filter(b => b.chainId === network);

  // Sum each stablecoin across the in-scope chains, ignoring dust/zero rows.
  const bySymbol = new Map<string, { amount: number; amountUsd: number }>();
  for (const { symbol, amount, amountUsd } of inScope) {
    if (amountUsd <= 0) continue;
    const entry = bySymbol.get(symbol) ?? { amount: 0, amountUsd: 0 };
    entry.amount += amount;
    entry.amountUsd += amountUsd;
    bySymbol.set(symbol, entry);
  }

  const walletBalance = [...bySymbol.values()].reduce((acc, entry) => acc + entry.amountUsd, 0);

  const tokens: IdleToken[] = [...bySymbol.entries()]
    .map(([symbol, entry]) => ({
      symbol,
      name: NAME_BY_SYMBOL.get(symbol) ?? symbol,
      amount: entry.amount,
      amountUsd: entry.amountUsd,
      ...(resolveTokenChartColors(symbol) ?? {
        color: FALLBACK_TOKEN_COLOR,
        hoverColor: FALLBACK_TOKEN_COLOR
      }),
      share: walletBalance > 0 ? entry.amountUsd / walletBalance : 0
    }))
    .sort((a, b) => b.amountUsd - a.amountUsd);

  return { tokens, walletBalance, idleCount: tokens.length };
}

/** Best available rate + number of venues accepting a token as a supply input. */
export type IdleSupplyInfo = {
  /** Highest current rate among venues accepting this token (decimal fraction). */
  bestRate?: number;
  /** Number of earn products that accept this token as a supply input. */
  venueCount: number;
};

/**
 * Indexes the marketplace rows by supply token → {venueCount, bestRate}. Drives
 * the Idle table rate badge: a bare rate when a token has a single venue, or
 * "up to [best rate]" when it has several.
 */
export function buildIdleSupplyInfo(rows: EarnProductRow[]): Map<string, IdleSupplyInfo> {
  const info = new Map<string, IdleSupplyInfo>();
  for (const row of rows) {
    for (const symbol of row.supplyTokens) {
      const key = symbol.toUpperCase();
      const entry = info.get(key) ?? { venueCount: 0 };
      entry.venueCount += 1;
      if (row.rate.value !== undefined) {
        entry.bestRate =
          entry.bestRate === undefined ? row.rate.value : Math.max(entry.bestRate, row.rate.value);
      }
      info.set(key, entry);
    }
  }
  return info;
}
