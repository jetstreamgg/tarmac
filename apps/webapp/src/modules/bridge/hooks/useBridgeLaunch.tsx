import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef } from 'react';
import { formatUnits } from 'viem';
import { useChainId, useChains } from 'wagmi';
import { t } from '@lingui/core/macro';
import { formatNumber } from '@/utils';
import { NO_VALUE } from '@/lib/constants';
import { useIsSafeWallet } from '@/hooks';
import { TxStatus } from '@/modules/ui/lib/txStatus';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { useMinimizedSessionLock } from '@/modules/ui/hooks/useMinimizedSessionLock';
import { stepFailureDetail, type TransactionStep } from '@/modules/ui/components/transactionStepsModel';
import { BridgeReviewContent, BridgeTransferHero } from '../components/BridgeReviewContent';
import { runMockLegs } from '../adapters/mockAdapter';
import { bridgeChainId } from '../model/networks';
import { applyProgress, createPendingBridge } from '../model/pendingTransitions';
import { pendingBridgeStore } from '../store/pendingStore';
import { withSourceRecording } from '../tracking/sourceRecording';
import type { BridgeFormModel } from './useBridgeForm';
import { usePendingScope } from './usePendingScope';

/**
 * The seam between the Bridge tab and `TransactionContext.launch()` (mirrors
 * `useConvertLaunch`). Confirm runs the source legs (approve + send) and
 * stores the pending bridge; a Safe's is stored as soon as it is queued. The
 * legs run on the mock executor until the route tickets add their calls.
 */
export function useBridgeLaunch(form: BridgeFormModel, onSuccess?: () => void) {
  const { launch: launchModal, updateModalContent, isModalOpen, txCallbacks, txStatus } = useTransaction();
  const sessionId = useId();
  const walletChainId = useChainId();
  const chains = useChains();
  const isSafe = useIsSafeWallet();
  const { account, scope, familyChainId } = usePendingScope();
  const { locked, restore } = useMinimizedSessionLock(sessionId);
  const { amount, from, to, route, recipient } = form;

  // Only the source-side legs run here; destination actions are their own modal.
  const steps = useMemo<TransactionStep[]>(
    () =>
      (route?.steps ?? [])
        .filter(step => step.network === from)
        .map(step =>
          step.action === 'approve'
            ? { label: t`Approve`, tokenSymbol: 'USDS', failureDetail: stepFailureDetail.approve('USDS') }
            : { label: t`Bridge`, tokenSymbol: 'USDS', failureDetail: t`The USDS hasn't been bridged.` }
        ),
    [route, from]
  );

  // The source chain, when the app can switch to it; otherwise the launch chain.
  const sourceChainId = bridgeChainId(from, familyChainId);
  const guardChainId =
    sourceChainId !== undefined && chains.some(chain => chain.id === sourceChainId)
      ? sourceChainId
      : walletChainId;

  const callbacksRef = useRef(txCallbacks);
  const executeRef = useRef<() => void>(() => undefined);
  useLayoutEffect(() => {
    callbacksRef.current = txCallbacks;
    executeRef.current = () => {
      if (!route || !account || !scope) return;
      // Snapshot at Confirm: the form may change or reset before the legs finish.
      const record = { account, amount, from, to, recipient, route };
      const callbacks = withSourceRecording(() => callbacksRef.current, {
        legs: steps.length,
        isSafe,
        onQueued: safeTxHash =>
          pendingBridgeStore.upsert(scope, createPendingBridge({ ...record, safeTxHash, now: Date.now() })),
        onExecuted: (txHash, safeTxHash) =>
          safeTxHash
            ? pendingBridgeStore.update(scope, safeTxHash, bridge =>
                applyProgress(bridge, { kind: 'source-executed', txHash }, Date.now())
              )
            : pendingBridgeStore.upsert(scope, createPendingBridge({ ...record, txHash, now: Date.now() }))
      });
      void runMockLegs(steps.length, () => callbacks);
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

  const amountLabel = `${formatNumber(parseFloat(formatUnits(amount, 18)), { maxDecimals: 2 })} USDS`;
  const confirmDisabled = amount === 0n || !route;

  const launch = useCallback(() => {
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
      usdValue: Number(formatUnits(amount, 18)),
      // The legs are built for the source network, so leaving it guards the flow.
      supportedChainIds: [guardChainId],
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
    guardChainId
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
