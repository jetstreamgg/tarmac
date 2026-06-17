import { resolveTokenColor } from '@/widgets/shared/constants';

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

/** One stablecoin balance on one chain, valued in USD. Emitted by the hook. */
export type StablecoinBalance = {
  symbol: string;
  chainId: number;
  amountUsd: number;
};

/** A stablecoin aggregated across the in-scope chains, decorated for display. */
export type IdleToken = {
  symbol: string;
  /** Full display name, e.g. 'Sky USD'. */
  name: string;
  amountUsd: number;
  /** Brand color (donut segment + legend swatch). */
  color: string;
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
  const usdBySymbol = new Map<string, number>();
  for (const { symbol, amountUsd } of inScope) {
    if (amountUsd <= 0) continue;
    usdBySymbol.set(symbol, (usdBySymbol.get(symbol) ?? 0) + amountUsd);
  }

  const walletBalance = [...usdBySymbol.values()].reduce((acc, usd) => acc + usd, 0);

  const tokens: IdleToken[] = [...usdBySymbol.entries()]
    .map(([symbol, amountUsd]) => ({
      symbol,
      name: NAME_BY_SYMBOL.get(symbol) ?? symbol,
      amountUsd,
      color: resolveTokenColor(symbol),
      share: walletBalance > 0 ? amountUsd / walletBalance : 0
    }))
    .sort((a, b) => b.amountUsd - a.amountUsd);

  return { tokens, walletBalance, idleCount: tokens.length };
}
