import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef } from 'react';
import { formatUnits } from 'viem';
import { useChainId } from 'wagmi';
import { t } from '@lingui/core/macro';
import { formatNumber } from '@/utils';
import { NO_VALUE } from '@/lib/constants';
import { TxStatus } from '@/modules/ui/lib/txStatus';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { useMinimizedSessionLock } from '@/modules/ui/hooks/useMinimizedSessionLock';
import { stepFailureDetail, type TransactionStep } from '@/modules/ui/components/transactionStepsModel';
import { BridgeReviewContent, BridgeTransferHero } from '../components/BridgeReviewContent';
import { mockPendingStore } from '../mocks/mockPendingStore';
import { runMockLegs } from '../mocks/mockExecutor';
import type { BridgeFormModel } from './useBridgeForm';

/**
 * The seam between the Bridge tab and `TransactionContext.launch()` (mirrors
 * `useConvertLaunch`). APP-611 runs a mock executor: Confirm walks the source
 * legs (approve + send) through the modal and records a pending bridge. The
 * real engine (APP-612) replaces `runMockLegs` and keeps this config.
 */
export function useBridgeLaunch(form: BridgeFormModel, onSuccess?: () => void) {
  const { launch: launchModal, updateModalContent, isModalOpen, txCallbacks, txStatus } = useTransaction();
  const sessionId = useId();
  const chainId = useChainId();
  const { locked, restore } = useMinimizedSessionLock(sessionId);
  const { amount, from, to, route, recipient } = form;

  // Only the source-side legs run here; a destination claim is its own modal.
  const steps = useMemo<TransactionStep[]>(
    () =>
      route.steps
        .filter(step => step.network === from)
        .map(step =>
          step.action === 'approve'
            ? { label: t`Approve`, tokenSymbol: 'USDS', failureDetail: stepFailureDetail.approve('USDS') }
            : { label: t`Bridge`, tokenSymbol: 'USDS', failureDetail: t`The USDS hasn't been bridged.` }
        ),
    [route, from]
  );

  const callbacksRef = useRef(txCallbacks);
  const executeRef = useRef<() => void>(() => undefined);
  useLayoutEffect(() => {
    callbacksRef.current = txCallbacks;
    executeRef.current = () => {
      void runMockLegs(steps.length, () => callbacksRef.current).then(txHash =>
        mockPendingStore.add({ amount, from, to, recipient, route, txHash })
      );
    };
  });

  const transactionContent = useMemo(
    () => <BridgeReviewContent amount={amount} from={from} to={to} route={route} networkFee={NO_VALUE} />,
    [amount, from, to, route]
  );
  const transactionScreenContent = useMemo(
    () => <BridgeTransferHero amount={amount} from={from} to={to} testId="bridge-modal-screen-summary" />,
    [amount, from, to]
  );

  const amountLabel = `${formatNumber(parseFloat(formatUnits(amount, 18)), { maxDecimals: 2 })} USDS`;
  const confirmDisabled = amount === 0n;

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
      // Mock: no calldata yet, so pin the launch chain like Convert. The real
      // engine pins the source network and switches to it at Confirm.
      supportedChainIds: [chainId],
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
    chainId
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
