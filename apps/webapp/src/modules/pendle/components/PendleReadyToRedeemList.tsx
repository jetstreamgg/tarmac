import { useEffect, useRef } from 'react';
import { Trans } from '@lingui/react/macro';
import {
  isMarketMatured,
  isPendleChain,
  PENDLE_MARKETS,
  usePendleUserPtBalances,
  type PendleMarketConfig
} from '@/hooks';
import { useChainId, useChains, useConnection } from 'wagmi';
import { Intent } from '@/lib/enums';
import { QueryParams } from '@/lib/constants';
import { useAppSearchParams } from '@/lib/navigation';
import { getNetworkOverrideForIntent } from '@/lib/widget-network-map';
import { useNetworkSwitch } from '@/modules/ui/context/NetworkSwitchContext';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { PendleMaturedPositionCard } from './PendleMaturedPositionCard';

/**
 * Portfolio "Ready to redeem" section (G6 — matured redemption lives here now
 * that the /earn/fixed overview is gone; the marketplace filters matured
 * markets out, so these positions appear nowhere else). Renders only when the
 * connected user holds matured PT for at least one market — otherwise returns
 * null so the section disappears entirely (no empty state).
 */
export const PendleReadyToRedeemList = () => {
  const { address } = useConnection();
  const chainId = useChainId();
  const chains = useChains();
  const [, setSearchParams] = useAppSearchParams();
  const { setIsSwitchingNetwork, setIsAutoSwitching } = useNetworkSwitch();
  const { data: ptBalances } = usePendleUserPtBalances();

  const maturedHeld: { market: PendleMarketConfig; ptBalance: bigint }[] = [];
  if (address && ptBalances) {
    PENDLE_MARKETS.forEach(market => {
      if (!isMarketMatured(market.expiry)) return;
      const balance = ptBalances[market.marketAddress];
      if (balance !== undefined && balance > 0n) {
        maturedHeld.push({ market, ptBalance: balance });
      }
    });
  }

  // Balances are read from mainnet regardless of the connected chain, but the
  // redeem transaction must be signed there — so landing here with matured PT
  // while on an L2 auto-switches the wallet the way module navigation does
  // (TopNav): flag the switch as automatic, then point ?network= at Ethereum;
  // the orchestration performs the wallet switch (a rejection resets the
  // param), the shell's network toast announces the change, and testnets are
  // exempt so a tenderly session is never disrupted. Once per mount: a
  // declined prompt must not re-fire on every render, and the section stays
  // visible either way (the cards disable their redeem buttons off-chain).
  const networkOverride =
    maturedHeld.length > 0 ? getNetworkOverrideForIntent(Intent.FIXED_INTENT, chainId, chains) : undefined;
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

  if (maturedHeld.length === 0) return null;

  return (
    <section data-testid="pendle-ready-to-redeem">
      <Heading tag="h3" variant="medium">
        <Trans>Your matured positions</Trans>
      </Heading>
      {!isPendleChain(chainId) && (
        <Text variant="small" className="text-textSecondary mt-2" data-testid="pendle-redeem-network-hint">
          <Trans>Redemption happens on Ethereum mainnet. Switch networks to redeem.</Trans>
        </Text>
      )}
      <div className="desktop:grid-cols-3 mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {maturedHeld.map(({ market, ptBalance }) => (
          <PendleMaturedPositionCard key={market.marketAddress} market={market} ptBalance={ptBalance} />
        ))}
      </div>
    </section>
  );
};
