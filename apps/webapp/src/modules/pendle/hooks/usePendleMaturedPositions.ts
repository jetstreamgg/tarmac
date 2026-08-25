import { useEffect, useRef } from 'react';
import { useChainId, useChains, useConnection } from 'wagmi';
import { isMarketMatured, PENDLE_MARKETS, usePendleUserPtBalances, type PendleMarketConfig } from '@/hooks';
import { Intent } from '@/lib/enums';
import { QueryParams } from '@/lib/constants';
import { useAppSearchParams } from '@/lib/navigation';
import { getNetworkOverrideForIntent } from '@/lib/widget-network-map';
import { useGeoConfig } from '@/modules/geo-config';
import { useNetworkSwitch } from '@/modules/ui/context/NetworkSwitchContext';

export type PendleMaturedPosition = { market: PendleMarketConfig; ptBalance: bigint };

/**
 * Matured PT the connected user holds, per market (G6 — the marketplace
 * filters matured markets out, so the Portfolio matured cards are these
 * positions' only surface, rendered in the Supplied carousel — Figma
 * 2306:72334). Pure read: the mainnet auto-switch lives in
 * `usePendleMaturedNetworkSwitch`, enabled only where a claim surface is
 * actually visible.
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

/**
 * Auto-switch the wallet to Ethereum while a claim surface is visible —
 * the redeem signs there. Same mechanics as module navigation
 * (destinations.tsx): auto-flagged ?network= override, orchestration
 * performs the switch, testnets exempt. Once per mount, so a declined
 * prompt doesn't re-fire; the cards stay visible off-chain either way.
 */
export function usePendleMaturedNetworkSwitch(enabled: boolean): void {
  const chainId = useChainId();
  const chains = useChains();
  const [, setSearchParams] = useAppSearchParams();
  const { setIsSwitchingNetwork, setIsAutoSwitching } = useNetworkSwitch();

  const networkOverride = enabled
    ? getNetworkOverrideForIntent(Intent.FIXED_INTENT, chainId, chains)
    : undefined;
  const promptedRef = useRef(false);
  useEffect(() => {
    if (!networkOverride || promptedRef.current) return;
    promptedRef.current = true;
    setIsSwitchingNetwork(true);
    setIsAutoSwitching(true);
    setSearchParams(
      params => {
        params.set(QueryParams.Network, networkOverride);
        return params;
      },
      { replace: true }
    );
  }, [networkOverride, setSearchParams, setIsSwitchingNetwork, setIsAutoSwitching]);
}
