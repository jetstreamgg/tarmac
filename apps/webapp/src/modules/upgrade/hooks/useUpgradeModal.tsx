import { useCallback, useId } from 'react';
import { t } from '@lingui/core/macro';
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

  const open = useCallback(() => {
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
      // The editable body lives outside the dialog (hidden host) so its in-flight
      // hook survives minimize; it portals its inputs into the modal's entry slot.
      backgroundContent: <UpgradeModalForm sessionId={sessionId} />,
      onConfirm: () => {}
    });
  }, [launch, sessionId]);

  return { open };
}
