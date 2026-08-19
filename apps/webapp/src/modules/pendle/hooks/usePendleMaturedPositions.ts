import { useEffect, useRef } from 'react';
import { useChainId, useChains, useConnection } from 'wagmi';
import {
  isMarketMatured,
  isPendleChain,
  PENDLE_MARKETS,
  usePendleUserPtBalances,
  type PendleMarketConfig
} from '@/hooks';
import { Intent } from '@/lib/enums';
import { QueryParams } from '@/lib/constants';
import { useAppSearchParams } from '@/lib/navigation';
import { getNetworkOverrideForIntent } from '@/lib/widget-network-map';
import { useNetworkSwitch } from '@/modules/ui/context/NetworkSwitchContext';

export type PendleMaturedPosition = { market: PendleMarketConfig; ptBalance: bigint };

/**
 * Matured PT the connected user holds, per market (G6 — the marketplace
 * filters matured markets out, so the Portfolio matured cards are these
 * positions' only surface). Extracted from the retired PendleReadyToRedeemList
 * when the cards moved into the Supplied carousel (Figma 2306:72334).
 *
 * Balances are read from mainnet regardless of the connected chain, but the
 * redeem transaction must be signed there — so holding matured PT while on an
 * L2 auto-switches the wallet the way module navigation does (TopNav): flag
 * the switch as automatic, then point ?network= at Ethereum; the orchestration
 * performs the wallet switch (a rejection resets the param), the shell's
 * network toast announces the change, and testnets are exempt so a tenderly
 * session is never disrupted. Once per mount: a declined prompt must not
 * re-fire on every render, and the cards stay visible either way (they disable
 * their Claim buttons off-chain — `onPendleChain`).
 */
export function usePendleMaturedPositions(): {
  maturedPositions: PendleMaturedPosition[];
  onPendleChain: boolean;
} {
  const { address } = useConnection();
  const chainId = useChainId();
  const chains = useChains();
  const [, setSearchParams] = useAppSearchParams();
  const { setIsSwitchingNetwork, setIsAutoSwitching } = useNetworkSwitch();
  const { data: ptBalances } = usePendleUserPtBalances();

  const maturedPositions: PendleMaturedPosition[] = [];
  if (address && ptBalances) {
    PENDLE_MARKETS.forEach(market => {
      if (!isMarketMatured(market.expiry)) return;
      const balance = ptBalances[market.marketAddress];
      if (balance !== undefined && balance > 0n) {
        maturedPositions.push({ market, ptBalance: balance });
      }
    });
  }

  const networkOverride =
    maturedPositions.length > 0
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

  return { maturedPositions, onPendleChain: isPendleChain(chainId) };
}
