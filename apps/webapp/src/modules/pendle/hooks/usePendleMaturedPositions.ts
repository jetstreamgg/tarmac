import { useConnection } from 'wagmi';
import { isMarketMatured, PENDLE_MARKETS, usePendleUserPtBalances, type PendleMarketConfig } from '@/hooks';
import { useGeoConfig } from '@/modules/geo-config';

export type PendleMaturedPosition = { market: PendleMarketConfig; ptBalance: bigint };

/**
 * Matured PT the connected user holds, per market (G6 — the marketplace
 * filters matured markets out, so the Portfolio matured cards are these
 * positions' only surface, rendered in the Supplied carousel — Figma
 * 2306:72334). Pure read: the claim cards switch the wallet on click
 * (usePendleRedeemModal), never on mount.
 *
 * Geo: empty while the `fixed` module is region-restricted — restricted
 * positions are hidden from every surface (APP-484 / useGeoVisibleRows), and
 * every consumer of this hook is such a surface. Same loading tradeoff as
 * useGeoVisibleRows: positions pass while the config is in flight, since the
 * loading default is restrictive and would blank them for everyone.
 */
export function usePendleMaturedPositions(): {
  maturedPositions: PendleMaturedPosition[];
  /** PT balances still resolving — matured holdings unknown, not absent. */
  isLoading: boolean;
} {
  const { address } = useConnection();
  const { data: ptBalances, isLoading } = usePendleUserPtBalances();
  const { isModuleEnabled, isLoading: isGeoLoading } = useGeoConfig();
  const fixedAvailable = isGeoLoading || isModuleEnabled('fixed');

  const maturedPositions: PendleMaturedPosition[] = [];
  if (fixedAvailable && address && ptBalances) {
    PENDLE_MARKETS.forEach(market => {
      if (!isMarketMatured(market.expiry)) return;
      const balance = ptBalances[market.marketAddress];
      if (balance !== undefined && balance > 0n) {
        maturedPositions.push({ market, ptBalance: balance });
      }
    });
  }

  return {
    maturedPositions,
    isLoading: !!address && (isLoading || ptBalances === undefined)
  };
}
