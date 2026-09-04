import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useConnection, useChainId } from 'wagmi';
import { t } from '@lingui/core/macro';
import {
  daiUsdsAddress,
  mcdDaiAddress,
  mkrAddress,
  mkrSkyAddress,
  useBatchUpgrade,
  useTokenAllowance,
  type UpgradeSourceToken
} from '@/hooks';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import type { TransactionStep } from '@/modules/ui/components/TransactionModal';
import { stepFailureDetail } from '@/modules/ui/components/transactionStepsModel';
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
 * step labels. The allowance read here is READ ONLY and only labels the
 * approve step (TanStack dedupes it with the engine's own read).
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
  const { address } = useConnection();
  const chainId = useChainId();

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

  const isDai = token === 'DAI';
  const target = UPGRADE_TARGET[token];

  // READ ONLY — labels the approve step only. Same read as the engine's own.
  const { data: allowance } = useTokenAllowance({
    chainId,
    contractAddress: isDai
      ? mcdDaiAddress[chainId as keyof typeof mcdDaiAddress]
      : mkrAddress[chainId as keyof typeof mkrAddress],
    owner: address,
    spender: isDai
      ? daiUsdsAddress[chainId as keyof typeof daiUsdsAddress]
      : mkrSkyAddress[chainId as keyof typeof mkrSkyAddress]
  });
  const needsAllowance = allowance === undefined || allowance < amount;

  const upgrade = useBatchUpgrade({
    token,
    amount,
    shouldUseBatch,
    ...txCallbacks,
    onSuccess: handleSuccess
  });

  // Step labels mirror the engine's call count so the indicator advances in
  // lockstep (the savings DAI-supply labelling convention).
  const steps = useMemo<TransactionStep[]>(() => {
    const upgradeStep: TransactionStep = {
      label: t`Upgrade ${token} to ${target}`,
      failureDetail: stepFailureDetail.upgrade(token)
    };
    return needsAllowance
      ? [
          { label: t`Approve`, tokenSymbol: token, failureDetail: stepFailureDetail.approve(token) },
          upgradeStep
        ]
      : [upgradeStep];
  }, [needsAllowance, token, target]);

  return toLaunchResult(upgrade, steps);
}
