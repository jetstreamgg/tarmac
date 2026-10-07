import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef } from 'react';
import { useChains } from 'wagmi';
import { t } from '@lingui/core/macro';
import { NO_VALUE } from '@/lib/constants';
import { useIsSafeWallet } from '@/hooks';
import { TxStatus } from '@/modules/ui/lib/txStatus';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { useMinimizedSessionLock } from '@/modules/ui/hooks/useMinimizedSessionLock';
import { stepFailureDetail, type TransactionStep } from '@/modules/ui/components/transactionStepsModel';
import { BridgeReviewContent, BridgeTransferHero } from '../components/BridgeReviewContent';
import { runMockLegs } from '../adapters/mockAdapter';
import { guardChainId } from '../model/networks';
import { applyProgress, createPendingBridge } from '../model/pendingTransitions';
import { formatUsds, usdsToNumber } from '../model/usds';
import { pendingBridgeStore } from '../store/pendingStore';
import { withSourceRecording } from '../tracking/sourceRecording';
import type { BridgeFormModel } from './useBridgeForm';
import { usePendingScope } from './usePendingScope';

/**
 * The seam between the Bridge tab and `TransactionContext.launch()` (mirrors
 * `useConvertLaunch`). Confirm runs the source legs (approve + send) and
 * stores the pending bridge once the send is broadcast, or queued for a Safe. The
 * legs run on the mock executor until the route tickets add their calls.
 */
export function useBridgeLaunch(form: BridgeFormModel, onSuccess?: () => void) {
  const { launch: launchModal, updateModalContent, isModalOpen, txCallbacks, txStatus } = useTransaction();
  const sessionId = useId();
  const chains = useChains();
  const isSafe = useIsSafeWallet();
  const { account, scope, familyChainId } = usePendingScope();
  const { locked, restore } = useMinimizedSessionLock(sessionId);
  const { amount, from, to, route, recipient } = form;

  // Only the source-side legs run here; destination actions are their own modal.
  const sourceActions = useMemo(
    () => (route?.steps ?? []).filter(step => step.network === from).map(step => step.action),
    [route, from]
  );
  const steps = useMemo<TransactionStep[]>(
    () =>
      sourceActions.map(action =>
        action === 'approve'
          ? { label: t`Approve`, tokenSymbol: 'USDS', failureDetail: stepFailureDetail.approve('USDS') }
          : { label: t`Bridge`, tokenSymbol: 'USDS', failureDetail: t`The USDS hasn't been bridged.` }
      ),
    [sourceActions]
  );

  const pinnedChainId = guardChainId({
    network: from,
    familyChainId,
    chainIds: chains.map(chain => chain.id)
  });

  const callbacksRef = useRef(txCallbacks);
  const executeRef = useRef<() => void>(() => undefined);
  // The chain the open modal guards; the source legs must run on it.
  const launchedChainIdRef = useRef<number | undefined>(undefined);
  // Set once this Review's bridge leg is broadcast or queued; Retry must not send it again.
  const sentRef = useRef(false);
  useLayoutEffect(() => {
    callbacksRef.current = txCallbacks;
    executeRef.current = () => {
      if (
        !form.isConnected ||
        form.reviewBlocked ||
        !route ||
        !account ||
        !scope ||
        pinnedChainId === undefined
      ) {
        callbacksRef.current.onError(new Error('The bridge is not ready to send.'));
        return;
      }
      if (sentRef.current) {
        callbacksRef.current.onError(new Error('The bridge was already sent.'));
        return;
      }
      if (pinnedChainId !== launchedChainIdRef.current) {
        callbacksRef.current.onError(new Error('The source network changed after Review.'));
        return;
      }
      // Snapshot at Confirm: the form may change or reset before the legs finish.
      const record = { account, amount, from, to, recipient, route };
      const callbacks = withSourceRecording(() => callbacksRef.current, {
        isSafe,
        // The mock names each leg after its step; route tickets pass their bridge call's name.
        bridgeFunctionName: 'send',
        onSent: txHash => {
          sentRef.current = true;
          pendingBridgeStore.upsert(scope, createPendingBridge({ ...record, txHash, now: Date.now() }));
        },
        onQueued: safeTxHash => {
          sentRef.current = true;
          pendingBridgeStore.upsert(scope, createPendingBridge({ ...record, safeTxHash, now: Date.now() }));
        },
        onExecuted: (txHash, safeTxHash) => {
          sentRef.current = true;
          if (safeTxHash) {
            // A no-op unless the queued bridge was dismissed: it executed anyway, so it comes back.
            pendingBridgeStore.upsert(scope, createPendingBridge({ ...record, safeTxHash, now: Date.now() }));
            pendingBridgeStore.update(scope, safeTxHash, bridge =>
              applyProgress(bridge, { kind: 'source-executed', txHash }, Date.now())
            );
          } else
            pendingBridgeStore.upsert(scope, createPendingBridge({ ...record, txHash, now: Date.now() }));
        },
        // Sped up in the wallet: the tracker reads the hash that will mine.
        onRepriced: (txHash, newTxHash) =>
          pendingBridgeStore.update(scope, txHash, bridge => ({ ...bridge, txHash: newTxHash })),
        // The funds never left, so Retry may send again.
        onFailed: (txHash, reason) => {
          sentRef.current = false;
          pendingBridgeStore.update(scope, txHash, bridge =>
            applyProgress(bridge, { kind: 'failed', reason }, Date.now())
          );
        }
      });
      void runMockLegs(sourceActions, () => callbacks);
    };
  });

  const transactionContent = useMemo(
    () =>
      route && (
        <BridgeReviewContent amount={amount} from={from} to={to} route={route} networkFee={NO_VALUE} />
      ),
    [amount, from, to, route]
  );
  const transactionScreenContent = useMemo(
    () => <BridgeTransferHero amount={amount} from={from} to={to} testId="bridge-modal-screen-summary" />,
    [amount, from, to]
  );

  const amountLabel = `${formatUsds(amount, { maxDecimals: 2 })} USDS`;
  const confirmDisabled = !form.isConnected || form.reviewBlocked;

  const launch = useCallback(() => {
    // No chain to guard: an empty guard would let the legs run on any chain.
    if (pinnedChainId === undefined) return;
    launchedChainIdRef.current = pinnedChainId;
    sentRef.current = false;
    launchModal({
      title: t`Review USDS bridge`,
      transactionTitle: t`Review USDS bridge`,
      toast: {
        loading: t`Bridging ${amountLabel}`,
        success: t`Bridge initiated!`,
        error: t`Bridge failed`
      },
      transactionContent,
      transactionScreenContent,
      steps,
      confirmLabel: t`Confirm`,
      confirmDisabled,
      onConfirm: () => executeRef.current(),
      onSuccess,
      sessionId,
      // USDS is $1-pegged; same valuation as Convert (enhanced screening, APP-517).
      usdValue: usdsToNumber(amount),
      // The legs are built for the source network, so leaving it guards the flow.
      supportedChainIds: [pinnedChainId],
      chainGuardReason: 'launch-chain'
    });
  }, [
    launchModal,
    amountLabel,
    transactionContent,
    transactionScreenContent,
    steps,
    confirmDisabled,
    onSuccess,
    sessionId,
    amount,
    pinnedChainId
  ]);

  useEffect(() => {
    if (!isModalOpen || txStatus !== TxStatus.IDLE) return;
    updateModalContent(sessionId, { transactionContent, transactionScreenContent, confirmDisabled, steps });
  }, [
    isModalOpen,
    txStatus,
    sessionId,
    updateModalContent,
    transactionContent,
    transactionScreenContent,
    confirmDisabled,
    steps
  ]);

  return { launch, locked, restore };
}
