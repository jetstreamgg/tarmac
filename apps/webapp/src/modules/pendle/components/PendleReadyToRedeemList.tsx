import { Trans } from '@lingui/react/macro';
import { isMarketMatured, PENDLE_MARKETS, usePendleUserPtBalances, type PendleMarketConfig } from '@/hooks';
import { useConnection } from 'wagmi';
import { Heading } from '@/modules/layout/components/Typography';
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

  if (maturedHeld.length === 0) return null;

  return (
    <section data-testid="pendle-ready-to-redeem">
      <Heading tag="h3" variant="medium">
        <Trans>Your matured positions</Trans>
      </Heading>
      <div className="desktop:grid-cols-3 mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {maturedHeld.map(({ market, ptBalance }) => (
          <PendleMaturedPositionCard key={market.marketAddress} market={market} ptBalance={ptBalance} />
        ))}
      </div>
    </section>
  );
};
