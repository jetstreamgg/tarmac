import { useCallback, useId, useLayoutEffect, useRef } from 'react';
import { formatUnits } from 'viem';
import { useChainId, useChains } from 'wagmi';
import { t } from '@lingui/core/macro';
import { formatNumber } from '@/utils';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { TransactionAmountHero } from '@/modules/ui/components/TransactionAmountHero';
import { stepFailureDetail } from '@/modules/ui/components/transactionStepsModel';
import { runMockLegs } from '../adapters/mockAdapter';
import { guardChainId } from '../model/networks';
import { recordAction } from '../model/pendingTransitions';
import type { PendingBridge, PendingBridgeNextAction } from '../model/types';
import { pendingBridgeStore } from '../store/pendingStore';
import { usePendingScope } from './usePendingScope';

const actionCopy = (action: PendingBridgeNextAction, amount: string) => {
  switch (action) {
    case 'claim':
      return {
        step: t`Claim`,
        loading: t`Claiming ${amount} USDS`,
        success: t`Funds claimed successfully!`,
        error: t`Claim failed`,
        failure: stepFailureDetail.claim('USDS')
      };
    case 'prove':
      return {
        step: t`Prove`,
        loading: t`Proving the withdrawal of ${amount} USDS`,
        success: t`Withdrawal proven!`,
        error: t`Prove failed`,
        failure: t`The withdrawal hasn't been proven.`
      };
    case 'finalize':
      return {
        step: t`Finalize`,
        loading: t`Finalizing the withdrawal of ${amount} USDS`,
        success: t`Funds received!`,
        error: t`Finalize failed`,
        failure: t`The withdrawal hasn't been finalized.`
      };
  }
};

/**
 * The bridge's next destination action (claim, prove or finalize; Figma
 * 3574:64565): the modal opens straight on the "Confirm" wallet screen with
 * the amount hero and a single action. Runs on the mock executor until the
 * route tickets add their calls.
 */
export function useDestinationActionLaunch() {
  const { launch: launchModal, txCallbacks } = useTransaction();
  const sessionId = useId();
  const walletChainId = useChainId();
  const chains = useChains();
  const { scope, familyChainId } = usePendingScope();

  const callbacksRef = useRef(txCallbacks);
  useLayoutEffect(() => {
    callbacksRef.current = txCallbacks;
  });

  return useCallback(
    (bridge: PendingBridge) => {
      const action = bridge.nextAction;
      if (!action || !scope) return;
      const amount = formatNumber(parseFloat(formatUnits(bridge.amount, 18)), {
        minDecimals: 2,
        maxDecimals: 2
      });
      const copy = actionCopy(action, amount);
      const pinnedChainId = guardChainId({
        network: bridge.to,
        familyChainId,
        chainIds: chains.map(chain => chain.id),
        walletChainId
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
        toast: { loading: copy.loading, success: copy.success, error: copy.error },
        steps: [{ label: copy.step, tokenSymbol: 'USDS', failureDetail: copy.failure }],
        onConfirm: () => {
          // A Safe's action is caught by the tracker once it lands, if this never resolves.
          void runMockLegs([action], () => callbacksRef.current).then(txHash =>
            pendingBridgeStore.update(scope, bridge.id, current =>
              recordAction(current, { action, txHash, at: Date.now() })
            )
          );
        },
        sessionId,
        usdValue: Number(formatUnits(bridge.amount, 18)),
        // Destination actions run on the destination network.
        supportedChainIds: [pinnedChainId],
        chainGuardReason: 'launch-chain'
      });
    },
    [launchModal, sessionId, scope, familyChainId, chains, walletChainId]
  );
}
