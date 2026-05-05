import { Trans } from '@lingui/react/macro';
import { motion } from 'motion/react';
import { positionAnimations } from '@jetstreamgg/sky-widgets';
import {
  isMarketMatured,
  PENDLE_MARKETS,
  usePendleUserPtBalances,
  type PendleMarketConfig
} from '@jetstreamgg/sky-hooks';
import { useConnection } from 'wagmi';
import { Heading } from '@/modules/layout/components/Typography';
import { PendleMaturedPositionCard } from './PendleMaturedPositionCard';

/**
 * List-page "Ready to redeem" section. Renders only when the connected user
 * holds matured PT for at least one market — otherwise returns null so the
 * section disappears entirely (no empty state).
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
    <motion.div className="space-y-3" variants={positionAnimations}>
      <Heading tag="h3" variant="medium">
        <Trans>Ready to redeem</Trans>
      </Heading>
      {maturedHeld.map(({ market, ptBalance }) => (
        <PendleMaturedPositionCard key={market.marketAddress} market={market} ptBalance={ptBalance} />
      ))}
    </motion.div>
  );
};
