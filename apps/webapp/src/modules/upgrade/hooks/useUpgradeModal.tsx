import { useCallback, useId } from 'react';
import type { UpgradeSourceToken } from '@/hooks';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { MAINNET_FAMILY_CHAIN_IDS } from '@/lib/chainAvailability';
import { UpgradeFlow } from '../components/UpgradeFlow';

/**
 * Reusable trigger for the "Upgrade DAI/MKR" modal (the upgrade surface has no
 * destination of its own — APP-413 resolved the parked decision in favour of
 * this modal). Mirrors `useStUsdsModal`: `launch()` replaces any idle open
 * modal (the desired "close the previous one" behaviour) and the provider's
 * in-flight guard restores a pending modal instead of starting a new session.
 */
export function useUpgradeModal() {
  const { launch } = useTransaction();
  const sessionId = useId();

  const open = useCallback(
    (initialToken: UpgradeSourceToken = 'DAI') =>
      launch({
        sessionId,
        // Upgrade is a mainnet-only product — guard the modal off any L2 (APP-528).
        supportedChainIds: MAINNET_FAMILY_CHAIN_IDS,
        flow: <UpgradeFlow initialToken={initialToken} />
      }),
    [launch, sessionId]
  );

  return { open };
}
