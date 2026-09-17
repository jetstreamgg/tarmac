import { useCallback, useId } from 'react';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { MAINNET_FAMILY_CHAIN_IDS } from '@/lib/chainAvailability';
import { UpgradeModalForm } from '../components/UpgradeModalForm';
import type { UpgradeSourceToken } from './useUpgradeLaunch';

/**
 * Reusable trigger for the "Upgrade DAI/MKR" modal (the upgrade surface has no
 * destination of its own — APP-413). `launch()` replaces any idle open modal
 * and the provider's in-flight guard restores a pending modal instead of
 * starting a new session. Upgrade is mainnet-only — the modal is guarded off
 * any L2 (APP-528). Analytics-free by design, following the stUSDS/savings
 * precedent.
 */
export function useUpgradeModal() {
  const { launch } = useTransaction();
  const sessionId = useId();

  const open = useCallback(
    (initialToken: UpgradeSourceToken = 'DAI') => {
      launch({
        sessionId,
        supportedChainIds: MAINNET_FAMILY_CHAIN_IDS,
        // Keyed by the source token so a relaunch with a different preselection
        // remounts the form instead of keeping the previous session's state.
        render: () => <UpgradeModalForm key={initialToken} initialToken={initialToken} />
      });
    },
    [launch, sessionId]
  );

  return { open };
}
