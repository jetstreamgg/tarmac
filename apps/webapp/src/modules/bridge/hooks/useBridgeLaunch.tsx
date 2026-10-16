import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useChains, usePublicClient } from 'wagmi';
import type { Hex } from 'viem';
import { useQueryClient } from '@tanstack/react-query';
import { t } from '@lingui/core/macro';
import { NO_VALUE } from '@/lib/constants';
import { useIsSafeWallet, useNetworkFee, useSafeWalletStatus, useTokenBalance } from '@/hooks';
import { TxStatus } from '@/modules/ui/lib/txStatus';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { useMinimizedSessionLock } from '@/modules/ui/hooks/useMinimizedSessionLock';
import { useShouldUseBatch } from '@/modules/ui/hooks/engineLaunch';
import { useResetPausedRunOnClose } from '@/modules/ui/hooks/useResetPausedRunOnClose';
import { enginePrepareErrorMessage } from '@/modules/ui/lib/enginePrepareErrorMessage';
import { stepFailureDetail, type TransactionStep } from '@/modules/ui/components/transactionStepsModel';
import { BridgeReviewContent, BridgeTransferHero } from '../components/BridgeReviewContent';
import { formatEthCeil, formatMaxEthFee } from '../components/bridgeModalRows';
import { runMockLegs } from '../adapters/mockAdapter';
import { guardChainId } from '../model/networks';
import { sendsToOther } from '../model/recipient';
import { applyProgress, createPendingBridge, failBundle } from '../model/pendingTransitions';
import { formatBigInt } from '@/utils';
import { usdsToNumber } from '../model/usds';
import { pendingBridgeStore } from '../store/pendingStore';
import { useIsSafeApp } from '@/hooks/wallet/useIsSafeApp';
import { withSourceRecording } from '../tracking/sourceRecording';
import { bundleDepositIn } from '../tracking/bundleDeposit';
import type { BridgeFormModel } from './useBridgeForm';
import { isNativeDepositNetwork, type NativeDepositNetwork } from '../adapters/nativeDeposit/contracts';
import { nativeDepositFunction, useNativeDepositLegs } from './useNativeDepositLegs';
import { usePendingScope } from './usePendingScope';
import { readsBalanceOn } from './balanceQueries';

const DETACHED: TxCallbacks = {
  onMutate: () => {},
  onStart: () => {},
  onSuccess: () => {},
  onError: () => {}
};

/**
 * The seam between the Bridge tab and `TransactionContext.launch()` (mirrors
 * `useConvertLaunch`). Confirm runs the source legs (approve + send) and
 * stores the pending bridge once the send is broadcast, or queued for a Safe.
 * Native deposits from Ethereum run their real calls; the other routes run on
 * the mock executor until their tickets add theirs.
 */
export function useBridgeLaunch(form: BridgeFormModel, onSuccess?: () => void) {
  const { launch: launchModal, updateModalContent, isModalOpen, txCallbacks, txStatus } = useTransaction();
  const sessionId = useId();
  const chains = useChains();
  const isSafe = useIsSafeWallet();
  const safeStatus = useSafeWalletStatus();
  const isSafeApp = useIsSafeApp();
  const queryClient = useQueryClient();
  const { account, scope, familyChainId } = usePendingScope();
  const { locked, restore } = useMinimizedSessionLock(sessionId);
  const { amount, from, to, route, recipient } = form;

  const pinnedChainId = guardChainId({
    network: from,
    familyChainId,
    chainIds: chains.map(chain => chain.id)
  });

  // The deposit a Confirm started: its later legs run even if the form stops passing Review.
  const [runningTo, setRunningTo] = useState<NativeDepositNetwork | undefined>(undefined);
  const depositTo =
    runningTo ??
    (route?.kind === 'native' && from === 'ethereum' && isNativeDepositNetwork(to) ? to : undefined);
  const isNativeDeposit = depositTo !== undefined;
  // The session callbacks of the Confirm that started the legs.
  const legCallbacksRef = useRef<TxCallbacks>(txCallbacks);
  // A Safe, or a wallet not known yet not to be one, signs one leg at a time.
  const batch = useShouldUseBatch(safeStatus === 'not-safe');
  // The wallet's id of the bundle it just accepted, set right before the bundle's onStart records it.
  const callsIdRef = useRef<string | undefined>(undefined);
  const l1 = usePublicClient({ chainId: pinnedChainId });
  const deposit = useNativeDepositLegs({
    enabled: isNativeDeposit && form.isConnected && (runningTo !== undefined || !form.reviewBlocked),
    // Any network while disabled.
    to: depositTo ?? 'arbitrum',
    chainId: pinnedChainId,
    account,
    recipient,
    amount,
    isSafeApp,
    batch,
    onCallsSent: id => {
      callsIdRef.current = id;
    },
    getCallbacks: () => legCallbacksRef.current
  });
  const { reset: resetDeposit, refetchAllowance } = deposit;
  // The Arbitrum ticket's ETH comes from the sender on Ethereum; unknown while loading, so Confirm waits.
  const { data: ethBalance } = useTokenBalance({
    address: account,
    chainId: pinnedChainId ?? 0,
    isNative: true,
    enabled: depositTo === 'arbitrum' && pinnedChainId !== undefined
  });
  const feeShort =
    depositTo === 'arbitrum' &&
    deposit.maxFee !== undefined &&
    (ethBalance === undefined || ethBalance.value < deposit.maxFee);
  const resetRun = useCallback(() => {
    setRunningTo(undefined);
    resetDeposit();
  }, [resetDeposit]);
  useResetPausedRunOnClose(resetRun, refetchAllowance);

  // Only the source-side legs run here; destination actions are their own modal.
  const routeActions = useMemo(
    () => (route?.steps ?? []).filter(step => step.network === from).map(step => step.action),
    [route, from]
  );
  // A real deposit approves only when its allowance is short.
  const sourceActions = useMemo(
    () =>
      isNativeDeposit
        ? routeActions.filter(action => action !== 'approve' || deposit.needsApprove)
        : routeActions,
    [isNativeDeposit, routeActions, deposit.needsApprove]
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

  const callbacksRef = useRef(txCallbacks);
  const executeRef = useRef<() => void>(() => undefined);
  // The chain the open modal guards; the source legs must run on it.
  const launchedChainIdRef = useRef<number | undefined>(undefined);
  // The account the Review was opened for; only it may sign the legs.
  const launchedAccountRef = useRef<string | undefined>(undefined);
  // Read at launch: connect-then-act calls a launch from before the wallet connected.
  const accountRef = useRef(account);
  const scopeRef = useRef(scope);
  // Set once a bridge leg from here is broadcast, queued or executed, unless a later Review confirmed; Confirm and Retry then send nothing.
  const sentRef = useRef(false);
  // Advanced by each Review: a prompt from an earlier Review signed late marks this one sent only until it confirms.
  const launchRef = useRef(0);
  // The Review of the latest Confirm.
  const confirmedLaunchRef = useRef(0);
  // A Confirm whose bridge leg wasn't sent ends with its modal, so the next Review can't resume it.
  const wasOpenRef = useRef(isModalOpen);
  useEffect(() => {
    const closed = wasOpenRef.current && !isModalOpen;
    wasOpenRef.current = isModalOpen;
    if (!closed || runningTo === undefined || sentRef.current) return;
    resetRun();
    refetchAllowance();
  }, [isModalOpen, runningTo, resetRun, refetchAllowance]);
  // The bridge sent here whose flow ended with no verdict; a new Review must not send again while it is pending.
  const unresolvedRef = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    callbacksRef.current = txCallbacks;
    accountRef.current = account;
    scopeRef.current = scope;
    executeRef.current = () => {
      if (
        !form.isConnected ||
        form.reviewBlocked ||
        !route ||
        !account ||
        !scope ||
        pinnedChainId === undefined ||
        (isNativeDeposit && !deposit.ready) ||
        feeShort
      ) {
        callbacksRef.current.onError(new Error('The bridge is not ready to send.'));
        return;
      }
      if (sentRef.current || unresolvedRef.current) {
        callbacksRef.current.onError(
          new Error(
            unresolvedRef.current
              ? 'The last bridge is still pending. Check it on its card before sending again.'
              : 'The bridge was already sent.'
          )
        );
        return;
      }
      if (pinnedChainId !== launchedChainIdRef.current) {
        callbacksRef.current.onError(new Error('The source network changed after Review.'));
        return;
      }
      if (account !== launchedAccountRef.current) {
        callbacksRef.current.onError(new Error('The wallet account changed after Review.'));
        return;
      }
      // Snapshot at Confirm: the form may change or reset before the legs finish.
      const record = { account, amount, from, to, recipient, route };
      // A prompt this Confirm opened can be signed after a later Confirm: the modal hears from it only while it is current.
      const isCurrent = () => !depositTo || legCallbacksRef.current === callbacks;
      const launchId = launchRef.current;
      confirmedLaunchRef.current = launchId;
      // Marks the bridge sent, by its card id; a Retry of its own Review then ends and the modal follows this send. After a later Review confirmed, it only blocks that Review's Retry until it settles, unless that Review already sent.
      const markSent = (id?: string) => {
        if (confirmedLaunchRef.current > launchId) {
          if (id && !sentRef.current) unresolvedRef.current = id;
          return;
        }
        const first = !sentRef.current;
        sentRef.current = true;
        if (id) unresolvedRef.current = id;
        if (first && !isCurrent()) {
          deposit.stop();
          legCallbacksRef.current = callbacks;
        }
      };
      const recording = withSourceRecording(() => (isCurrent() ? callbacksRef.current : DETACHED), {
        isSafe,
        // The mock names each leg after its step.
        bridgeFunctionName: depositTo ? nativeDepositFunction(depositTo) : 'send',
        onSent: txHash => {
          pendingBridgeStore.upsert(scope, createPendingBridge({ ...record, txHash, now: Date.now() }));
          markSent(txHash);
        },
        onQueued: safeTxHash => {
          // Not unresolved: it waits for co-signers, and a Safe may queue several bridges.
          pendingBridgeStore.upsert(scope, createPendingBridge({ ...record, safeTxHash, now: Date.now() }));
          markSent();
        },
        onExecuted: (txHash, safeTxHash) => {
          markSent();
          if (safeTxHash) {
            // A no-op unless the queued bridge was dismissed: it executed anyway, so it comes back.
            pendingBridgeStore.upsert(scope, createPendingBridge({ ...record, safeTxHash, now: Date.now() }));
            pendingBridgeStore.update(scope, safeTxHash, bridge =>
              applyProgress(bridge, { kind: 'source-executed', txHash }, Date.now())
            );
          } else
            pendingBridgeStore.upsert(scope, createPendingBridge({ ...record, txHash, now: Date.now() }));
        },
        // A bundle has no hash until it mines.
        onBundled: () => {
          const bundleId = `bundle-${crypto.randomUUID()}`;
          const callsId = callsIdRef.current;
          callsIdRef.current = undefined;
          pendingBridgeStore.upsert(
            scope,
            createPendingBridge({ ...record, bundleId, callsId, now: Date.now() })
          );
          markSent(bundleId);
          return bundleId;
        },
        // Its card gets the deposit's hash from the receipt; recovery reads it from the chain when that fails.
        onBundleMined: (bundleId, hash) =>
          void (async () => {
            const bridge = pendingBridgeStore.getSnapshot(scope).find(entry => entry.id === bundleId);
            try {
              const receipt = bridge && hash && (await l1?.getTransactionReceipt({ hash: hash as Hex }));
              const deposit = bridge && receipt ? bundleDepositIn(bridge, [receipt]) : undefined;
              if (deposit) {
                pendingBridgeStore.resolveBundle(scope, bundleId, deposit.txHash);
                const hash = deposit.txHash.toLowerCase();
                // Untracked when a scan gave its card another deposit like it: recovery gives this one its own card.
                const tracked = pendingBridgeStore
                  .getSnapshot(scope)
                  .some(entry => entry.id.toLowerCase() === hash || entry.txHash?.toLowerCase() === hash);
                if (tracked) return;
              }
            } catch {
              // Read by recovery.
            }
            void queryClient.invalidateQueries({ queryKey: ['bridge-deposit-recovery', scope] });
          })(),
        // Sped up in the wallet: the tracker reads the hash that will mine.
        onRepriced: (txHash, newTxHash) =>
          pendingBridgeStore.update(scope, txHash, bridge => ({ ...bridge, txHash: newTxHash })),
        // The funds never left, so Retry may send again.
        onFailed: (id, reason) => {
          if (unresolvedRef.current === id) {
            sentRef.current = false;
            unresolvedRef.current = undefined;
          }
          pendingBridgeStore.update(scope, id, bridge =>
            bridge.bundleId
              ? failBundle(bridge, reason, Date.now())
              : applyProgress(bridge, { kind: 'failed', reason }, Date.now())
          );
          // A wallet that broke the bundle up may have sent the deposit anyway.
          if (id.startsWith('bundle-'))
            void queryClient.invalidateQueries({ queryKey: ['bridge-deposit-recovery', scope] });
        }
      });
      const callbacks: TxCallbacks = {
        ...recording,
        onSuccess: (hash, blockNumber) => {
          unresolvedRef.current = undefined;
          setRunningTo(undefined);
          // The next deposit's approve depends on what this one spent.
          deposit.refetchAllowance();
          if (pinnedChainId !== undefined)
            void queryClient.invalidateQueries({ predicate: readsBalanceOn(pinnedChainId) });
          recording.onSuccess(hash, blockNumber);
        }
      };
      if (depositTo) {
        legCallbacksRef.current = callbacks;
        setRunningTo(depositTo);
        deposit.execute();
      } else void runMockLegs(sourceActions, () => callbacks);
    };
  });

  const bridgeFee = deposit.maxFee !== undefined ? formatMaxEthFee(deposit.maxFee) : undefined;
  // Gas only; the Arbitrum ticket's ETH is the bridge fee.
  const { data: networkFee } = useNetworkFee({
    calls: deposit.calls,
    chainId: pinnedChainId,
    shouldUseBatch: deposit.isBatch,
    enabled: isNativeDeposit && deposit.calls.length > 0
  });
  const networkFeeText = networkFee?.formatted ?? NO_VALUE;
  // Arbitrum refunds a contract's unused fee to its L2 alias, which a Safe reaches only through Ethereum.
  const aliasedRefund = isSafe && depositTo === 'arbitrum' && !sendsToOther(recipient, account);
  const transactionContent = useMemo(
    () =>
      route && (
        <BridgeReviewContent
          amount={amount}
          from={from}
          to={to}
          route={route}
          networkFee={networkFeeText}
          bridgeFee={bridgeFee}
          aliasedRefund={aliasedRefund}
        />
      ),
    [amount, from, to, route, networkFeeText, bridgeFee, aliasedRefund]
  );
  const transactionScreenContent = useMemo(
    () => <BridgeTransferHero amount={amount} from={from} to={to} testId="bridge-modal-screen-summary" />,
    [amount, from, to]
  );

  const amountLabel = `${formatBigInt(amount, { maxDecimals: 2 })} USDS`;
  const confirmDisabled =
    !form.isConnected || form.reviewBlocked || (isNativeDeposit && !deposit.ready) || feeShort;
  // The mock routes send one leg at a time.
  const bundled = isNativeDeposit && deposit.isBatch;
  const feeText = deposit.maxFee !== undefined ? formatEthCeil(deposit.maxFee) : NO_VALUE;
  const errorMessage =
    feeShort && ethBalance
      ? t`You need at least ${feeText} ETH on Ethereum to pay the Arbitrum bridge fee.`
      : isNativeDeposit
        ? enginePrepareErrorMessage(deposit.ready, deposit.error)
        : undefined;

  const launch = useCallback(() => {
    // No chain to guard: an empty guard would let the legs run on any chain.
    if (pinnedChainId === undefined) return;
    launchRef.current += 1;
    launchedChainIdRef.current = pinnedChainId;
    launchedAccountRef.current = accountRef.current;
    // A send whose outcome is unknown (a failed receipt wait) may still land: wait for its card to settle.
    const launchScope = scopeRef.current;
    const unresolved =
      unresolvedRef.current && launchScope
        ? pendingBridgeStore.getSnapshot(launchScope).find(bridge => bridge.id === unresolvedRef.current)
        : undefined;
    if (unresolved?.status !== 'pending') {
      unresolvedRef.current = undefined;
      sentRef.current = false;
    }
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
      bundled,
      errorMessage,
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
    bundled,
    errorMessage,
    onSuccess,
    sessionId,
    amount,
    pinnedChainId
  ]);

  useEffect(() => {
    if (!isModalOpen || txStatus !== TxStatus.IDLE) return;
    updateModalContent(sessionId, {
      transactionContent,
      transactionScreenContent,
      confirmDisabled,
      bundled,
      errorMessage,
      steps
    });
  }, [
    isModalOpen,
    txStatus,
    sessionId,
    updateModalContent,
    transactionContent,
    transactionScreenContent,
    confirmDisabled,
    bundled,
    errorMessage,
    steps
  ]);

  return { launch, locked, restore };
}
