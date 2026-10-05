import { useCallback, useId, useLayoutEffect, useRef } from 'react';
import { formatUnits } from 'viem';
import { useChainId } from 'wagmi';
import { t } from '@lingui/core/macro';
import { formatNumber } from '@/utils';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { TransactionAmountHero } from '@/modules/ui/components/TransactionAmountHero';
import { stepFailureDetail } from '@/modules/ui/components/transactionStepsModel';
import { mockPendingStore } from '../mocks/mockPendingStore';
import { runMockLegs } from '../mocks/mockExecutor';
import type { PendingBridge } from '../model/types';

/**
 * Claim on the destination (Figma 3574:64565): the modal opens straight on the
 * "Confirm" wallet screen with the amount hero and a single Claim USDS action.
 * Mock executor for APP-611; the CCTP claim (APP-614) replaces it.
 */
export function useClaimLaunch() {
  const { launch: launchModal, txCallbacks } = useTransaction();
  const sessionId = useId();
  const chainId = useChainId();

  const callbacksRef = useRef(txCallbacks);
  useLayoutEffect(() => {
    callbacksRef.current = txCallbacks;
  });

  return useCallback(
    (bridge: PendingBridge) => {
      const amount = formatNumber(parseFloat(formatUnits(bridge.amount, 18)), {
        minDecimals: 2,
        maxDecimals: 2
      });
      launchModal({
        title: t`Confirm`,
        skipReview: true,
        transactionScreenContent: (
          <TransactionAmountHero
            label={t`Amount`}
            amount={amount}
            symbol="USDS"
            dataTestId="bridge-claim-amount"
          />
        ),
        toast: {
          loading: t`Claiming ${amount} USDS`,
          success: t`Funds claimed successfully!`,
          error: t`Claim failed`
        },
        steps: [{ label: t`Claim`, tokenSymbol: 'USDS', failureDetail: stepFailureDetail.claim('USDS') }],
        onConfirm: () => {
          void runMockLegs(1, () => callbacksRef.current).then(hash =>
            mockPendingStore.markClaimed(bridge.id, hash)
          );
        },
        sessionId,
        usdValue: Number(formatUnits(bridge.amount, 18)),
        supportedChainIds: [chainId],
        chainGuardReason: 'launch-chain'
      });
    },
    [launchModal, sessionId, chainId]
  );
}
