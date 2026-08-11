import { mainnet } from 'viem/chains';
import { isTestnetId } from '@/utils';

/** Whether a market has matured (expiry timestamp <= now). */
export function isMarketMatured(_expiry: number): boolean {
  // DEMO BRANCH — DO NOT MERGE: force every market matured so the dormant
  // redeem flow is visible before the real Nov 2026 maturity.
  return true;
}

/**
 * Pendle markets exist only on Ethereum mainnet (or its testnet forks in dev),
 * so pendle transactions must be signed there. Reads stay pinned to mainnet in
 * the pendle hooks regardless of the connected chain.
 */
export function isPendleChain(chainId: number): boolean {
  return isTestnetId(chainId) || chainId === mainnet.id;
}

/**
 * Display name for a Pendle aggregator. Pendle's API returns the route
 * source in SCREAMING_SNAKE_CASE (e.g. "KYBERSWAP"); we render it with
 * canonical brand casing wherever the aggregator badge surfaces (the
 * SupplyWithdraw overview and the matured-redeem overview both use this).
 * Unknown values pass through unchanged so a future aggregator addition
 * still renders something sensible.
 */
export function formatPendleAggregatorName(raw: string): string {
  const known: Record<string, string> = {
    KYBERSWAP: 'KyberSwap',
    ODOS: 'Odos',
    OKX: 'OKX',
    PARASWAP: 'Paraswap'
  };
  return known[raw.toUpperCase()] ?? raw;
}
