import { useEffect } from 'react';
import type { PendleMarketConfig } from '@/hooks';
import { usePendleRedeemModal } from '../hooks/usePendleRedeemModal';

/**
 * Renderless host for one market's claim modal, for surfaces whose rows are
 * data-driven rather than componentized (the Earn "Requires action" table):
 * mounts the redeem hook and hands its opener up, so a row click can launch
 * the modal in place instead of detouring through the Portfolio.
 */
export function PendleClaimLauncher({
  market,
  onReady
}: {
  market: PendleMarketConfig;
  /** Receives the current modal opener; re-fires as the hook's content updates. */
  onReady: (open: () => void) => void;
}) {
  const { openRedeemModal } = usePendleRedeemModal(market);
  useEffect(() => {
    onReady(openRedeemModal);
  }, [onReady, openRedeemModal]);
  return null;
}
