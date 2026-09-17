import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { t } from '@lingui/core/macro';
import { getWriteContractCall, useApproveThenAct, useTokenAllowance } from '@/hooks';
import {
  daiUsdsAbi,
  daiUsdsAddress,
  mcdDaiAddress,
  mkrAddress,
  mkrSkyAbi,
  mkrSkyAddress
} from '@/hooks/generated';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import type { TransactionStep } from '@/modules/ui/components/TransactionModal';
import { approveStep, stepFailureDetail, stepsFromPlan } from '@/modules/ui/components/transactionStepsModel';
import { toLaunchResult, useShouldUseBatch, type EngineLaunchResult } from '@/modules/ui/hooks/engineLaunch';

/** The two upgradeable source tokens; each has a fixed upgrader + target. */
export type UpgradeSourceToken = 'DAI' | 'MKR';

/** Fixed upgrade pairs: each source token has exactly one target. */
export const UPGRADE_TARGET: Record<UpgradeSourceToken, 'USDS' | 'SKY'> = {
  DAI: 'USDS',
  MKR: 'SKY'
};

export type UseUpgradeLaunchResult = EngineLaunchResult;

/**
 * The seam between the upgrade modal and the engine: approve? → `daiToUsds`
 * (DAI → USDS) or `mkrToSky` (MKR → SKY), steps read off the plan.
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
  const source = isDai
    ? mcdDaiAddress[chainId as keyof typeof mcdDaiAddress]
    : mkrAddress[chainId as keyof typeof mkrAddress];
  const upgrader = isDai
    ? daiUsdsAddress[chainId as keyof typeof daiUsdsAddress]
    : mkrSkyAddress[chainId as keyof typeof mkrSkyAddress];

  const { data: allowance, error: allowanceError } = useTokenAllowance({
    chainId,
    contractAddress: source,
    owner: address,
    spender: upgrader
  });

  const upgrade = useApproveThenAct({
    chainId,
    enabled: amount !== 0n,
    shouldUseBatch,
    legs: [
      {
        approve: { token: source, spender: upgrader, amount, allowance, allowanceError },
        // Built only once an address exists: the upgrade modal opens while
        // disconnected, and an `undefined` recipient in the args makes consumers
        // that encode the calldata during render (useNetworkFee's calls key)
        // throw viem's InvalidAddressError.
        calls: !address
          ? []
          : [
              isDai
                ? getWriteContractCall({
                    to: upgrader,
                    abi: daiUsdsAbi,
                    functionName: 'daiToUsds',
                    args: [address, amount]
                  })
                : getWriteContractCall({
                    to: upgrader,
                    abi: mkrSkyAbi,
                    functionName: 'mkrToSky',
                    args: [address, amount]
                  })
            ]
      }
    ],
    ...txCallbacks,
    onSuccess: handleSuccess
  });

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
