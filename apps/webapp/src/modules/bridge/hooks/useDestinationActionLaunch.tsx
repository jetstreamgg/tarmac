import { useCallback, useId, useLayoutEffect, useRef } from 'react';
import { useChains } from 'wagmi';
import { t } from '@lingui/core/macro';
import { useIsSafeWallet } from '@/hooks';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { useMinimizedSessionLock } from '@/modules/ui/hooks/useMinimizedSessionLock';
import { TransactionAmountHero } from '@/modules/ui/components/TransactionAmountHero';
import { stepFailureDetail } from '@/modules/ui/components/transactionStepsModel';
import { runMockLegs } from '../adapters/mockAdapter';
import { guardChainId } from '../model/networks';
import { canLaunchAction, dropSentAction, recordAction, recordActionSent } from '../model/pendingTransitions';
import type { PendingBridge, PendingBridgeNextAction } from '../model/types';
import { formatBigInt } from '@/utils';
import { usdsToNumber } from '../model/usds';
import { pendingBridgeStore } from '../store/pendingStore';
import { withActionRecording } from '../tracking/actionRecording';
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
 * route tickets add their calls. `locked` is true while its session is minimized;
 * `canLaunch` is false when the action can't be sent or its network can't be pinned.
 */
export function useDestinationActionLaunch() {
  const { launch: launchModal, txCallbacks } = useTransaction();
  const sessionId = useId();
  const chains = useChains();
  const isSafe = useIsSafeWallet();
  const { scope, familyChainId } = usePendingScope();
  const { locked } = useMinimizedSessionLock(sessionId);

  const callbacksRef = useRef(txCallbacks);
  useLayoutEffect(() => {
    callbacksRef.current = txCallbacks;
  });

  const pinChainId = useCallback(
    (bridge: PendingBridge) =>
      guardChainId({ network: bridge.to, familyChainId, chainIds: chains.map(chain => chain.id) }),
    [familyChainId, chains]
  );

  const canLaunch = useCallback(
    (bridge: PendingBridge) => canLaunchAction(bridge) && pinChainId(bridge) !== undefined,
    [pinChainId]
  );

  const launch = useCallback(
    (card: PendingBridge) => {
      if (!scope) return;
      // The card can predate a broadcast; the store has the sent action.
      const bridge = pendingBridgeStore.getSnapshot(scope).find(entry => entry.id === card.id);
      const action = bridge?.nextAction;
      if (!bridge || !action || !canLaunchAction(bridge)) return;
      const amount = formatBigInt(bridge.amount, { minDecimals: 2, maxDecimals: 2 });
      const copy = actionCopy(action, amount);
      const pinnedChainId = pinChainId(bridge);
      if (pinnedChainId === undefined) return;
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
          // Retry calls onConfirm again; an action already sent must not go out twice.
          const current = pendingBridgeStore.getSnapshot(scope).find(entry => entry.id === bridge.id);
          if (!current || current.nextAction !== action || !canLaunchAction(current)) {
            callbacksRef.current.onError(new Error('This action was already sent.'));
            return;
          }
          const record =
            (change: (current: PendingBridge, txHash: string) => PendingBridge) => (txHash: string) =>
              pendingBridgeStore.update(scope, bridge.id, current => change(current, txHash));
          const callbacks = withActionRecording(() => callbacksRef.current, {
            // A Safe reports its Safe tx hash here; the tracker settles it if this flow can't.
            onSent: record((current, txHash) =>
              recordActionSent(current, { action, txHash, at: Date.now(), ...(isSafe && { safe: true }) })
            ),
            onConfirmed: record((current, txHash) =>
              recordAction(current, { action, txHash, at: Date.now() })
            ),
            onReverted: record(dropSentAction)
          });
          void runMockLegs([action], () => callbacks);
        },
        sessionId,
        usdValue: usdsToNumber(bridge.amount),
        // Destination actions run on the destination network.
        supportedChainIds: [pinnedChainId],
        chainGuardReason: 'launch-chain'
      });
    },
    [launchModal, sessionId, scope, pinChainId, isSafe]
  );

  return { launch, canLaunch, locked };
}
