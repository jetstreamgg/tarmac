import { mainnet } from 'viem/chains';
import { isTestnetId } from '@/utils';
import type { PendleMarketConfig } from './pendle';

/** Whether a market has matured (expiry timestamp <= now). */
export function isMarketMatured(expiry: number): boolean {
  return Math.floor(Date.now() / 1000) >= expiry;
}

const ptMaturityMonthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });

/**
 * The PT's on-chain ticker, maturity included ("PT-sUSDS-26NOV2026"), which
 * tells apart two markets on the same underlying. Expiries are UTC instants.
 */
export function pendlePtTicker(market: Pick<PendleMarketConfig, 'underlyingSymbol' | 'expiry'>): string {
  const expiry = new Date(market.expiry * 1000);
  const day = String(expiry.getUTCDate()).padStart(2, '0');
  const month = ptMaturityMonthFormatter.format(expiry).toUpperCase();
  return `PT-${market.underlyingSymbol}-${day}${month}${expiry.getUTCFullYear()}`;
}

const maturityMonthFormatter = new Intl.DateTimeFormat('en-GB', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC'
});

/**
 * Display name for a matured market ("Fixed Yield · Nov 2026"). Markets share
 * one product name, so the maturity tells a matured position apart from the
 * live market that succeeded it.
 */
export function maturedPendleMarketName(market: Pick<PendleMarketConfig, 'name' | 'expiry'>): string {
  return `${market.name} · ${maturityMonthFormatter.format(new Date(market.expiry * 1000))}`;
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
