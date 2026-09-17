import { useCallback, useEffect, useMemo, useRef } from 'react';
import { t } from '@lingui/core/macro';
import { useBatchUpgrade, type UpgradeSourceToken } from '@/hooks';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import type { TransactionStep } from '@/modules/ui/components/TransactionModal';
import { approveStep, stepFailureDetail, stepsFromPlan } from '@/modules/ui/components/transactionStepsModel';
import { toLaunchResult, useShouldUseBatch, type EngineLaunchResult } from '@/modules/ui/hooks/engineLaunch';

/** Fixed upgrade pairs: each source token has exactly one target. */
export const UPGRADE_TARGET: Record<UpgradeSourceToken, 'USDS' | 'SKY'> = {
  DAI: 'USDS',
  MKR: 'SKY'
};

export type UseUpgradeLaunchResult = EngineLaunchResult;

/**
 * The seam between the upgrade modal and the (unmodified) `useBatchUpgrade`
 * engine — the upgrade analogue of `useStUsdsLaunch`: spreads the context's
 * `txCallbacks` into the engine, honours the batch toggle, and derives the
 * step labels off the engine's plan.
 */
export function useUpgradeLaunch({
  token,
  amount,
  onSuccess
}: {
  token: UpgradeSourceToken;
  amount: bigint;
  /**
   * Post-success side effect owned by the caller (refetching chain state the
   * engine doesn't). Runs ahead of the provider's own onSuccess, which closes
   * the modal and tears the session down.
   */
  onSuccess?: () => void;
}): UseUpgradeLaunchResult {
  const { txCallbacks } = useTransaction();

  const shouldUseBatch = useShouldUseBatch();

  // Held in a ref so a caller's inline arrow can't churn the engine's params.
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);
  const providerOnSuccess = txCallbacks.onSuccess;
  const handleSuccess = useCallback(
    (hash?: string) => {
      onSuccessRef.current?.();
      providerOnSuccess(hash);
    },
    [providerOnSuccess]
  );

  const target = UPGRADE_TARGET[token];

  const upgrade = useBatchUpgrade({
    token,
    amount,
    shouldUseBatch,
    ...txCallbacks,
    onSuccess: handleSuccess
  });

  // Step labels come off the engine's plan, so an approve shows exactly when
  // the engine sends one (the savings DAI-supply labelling convention).
  const plan = upgrade.plan;
  const steps = useMemo<TransactionStep[]>(
    () =>
      stepsFromPlan(plan, [
        {
          approve: approveStep(token),
          action: { label: t`Upgrade ${token} to ${target}`, failureDetail: stepFailureDetail.upgrade(token) }
        }
      ]),
    [plan, token, target]
  );

  return toLaunchResult(upgrade, steps);
}
