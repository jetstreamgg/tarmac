import { useCallback, useId } from 'react';
import { t } from '@lingui/core/macro';
import type { UpgradeSourceToken } from '@/hooks';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { UpgradeModalForm } from '../components/UpgradeModalForm';

/**
 * Reusable trigger for the "Upgrade DAI/MKR" modal (the upgrade surface has no
 * destination of its own — APP-413 resolved the parked decision in favour of
 * this modal). Mirrors `useStUsdsModal`: `launch()` replaces any idle open
 * modal (the desired "close the previous one" behaviour) and the provider's
 * in-flight guard restores a pending modal instead of starting a new session.
 *
 * Analytics-free by design, following the stUSDS/savings-modal precedent.
 */
export function useUpgradeModal() {
  const { launch } = useTransaction();
  const sessionId = useId();

  const open = useCallback(
    (initialToken: UpgradeSourceToken = 'DAI') => {
      launch({
        title: t`Upgrade DAI/MKR`,
        transactionTitle: t`Confirm upgrade`,
        subtitles: {
          loading: t`Your upgrade is being processed on the blockchain. Please wait.`,
          success: t`You've successfully upgraded your tokens.`,
          error: t`An error occurred while upgrading your tokens.`
        },
        sessionId,
        entry: { confirmLabel: t`Continue`, confirmDisabled: true },
        // Nothing entered yet; the form keeps this live (enhanced screening, APP-517).
        usdValue: 0,
        // The editable body lives outside the dialog (hidden host) so its in-flight
        // hook survives minimize; it portals its inputs into the modal's entry slot.
        // Keyed by the source token so a relaunch with a different preselection
        // remounts the form instead of keeping the previous session's state.
        backgroundContent: (
          <UpgradeModalForm key={initialToken} sessionId={sessionId} initialToken={initialToken} />
        ),
        onConfirm: () => {}
      });
    },
    [launch, sessionId]
  );

  return { open };
}
