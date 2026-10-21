import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useChains, usePublicClient } from 'wagmi';
import type { Hex } from 'viem';
import { useQueryClient } from '@tanstack/react-query';
import { t } from '@lingui/core/macro';
import { NO_VALUE } from '@/lib/constants';
import { TransactionRefusedError } from '@/hooks/shared/useTransactionOutcome';
import { useIsSafeWallet, useNetworkFee, useSafeWalletStatus, useTokenBalance } from '@/hooks';
import { TxStatus } from '@/modules/ui/lib/txStatus';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { useMinimizedSessionLock } from '@/modules/ui/hooks/useMinimizedSessionLock';
import { useShouldUseBatch } from '@/modules/ui/hooks/engineLaunch';
import { useResetUnfinishedRunOnClose } from '@/modules/ui/hooks/useResetUnfinishedRunOnClose';
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
import type { UnfinishedCctpSwap } from '../store/cctpSwapStore';
import { isStorageWritable } from '../store/storageWritable';
import { useIsSafeApp } from '@/hooks/wallet/useIsSafeApp';
import { withSourceRecording } from '../tracking/sourceRecording';
import { bundleDepositIn } from '../tracking/bundleDeposit';
import type { BridgeFormModel } from './useBridgeForm';
import { isNativeDepositNetwork, type NativeDepositNetwork } from '../adapters/nativeDeposit/contracts';
import { nativeDepositFunction, useNativeDepositLegs } from './useNativeDepositLegs';
import { cctpL2Contracts, isCctpL2Network, type CctpL2NetworkId } from '../adapters/cctp/contracts';
import { CCTP_BURN_FUNCTION, useCctpBurnLegs } from './useCctpBurnLegs';
import { usePendingScope } from './usePendingScope';
import { readsBalanceOn } from './balanceQueries';

const cctpUsds = (network: CctpL2NetworkId | undefined) =>
  network ? cctpL2Contracts(network).usds : undefined;

/** What the launch reads from the form. */
export type BridgeLaunchForm = Pick<
  BridgeFormModel,
  'amount' | 'from' | 'to' | 'route' | 'recipient' | 'isConnected' | 'reviewBlocked'
> &
  Partial<Pick<BridgeFormModel, 'senderIsContract'>>;

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
 * Native deposits from Ethereum and CCTP burns to Ethereum run their real
 * calls; the other routes run on the mock executor until their tickets add theirs.
 * With `resume`, the burn continues a CCTP swap sent before, for that swap's USDC.
 */
export function useBridgeLaunch(form: BridgeLaunchForm, onSuccess?: () => void, resume?: UnfinishedCctpSwap) {
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
  const [runningBurn, setRunningBurn] = useState<CctpL2NetworkId | undefined>(undefined);
  const burnFrom =
    runningBurn ??
    (runningTo === undefined && route?.kind === 'cctp' && to === 'ethereum' && isCctpL2Network(from)
      ? from
      : undefined);
  const isCctpBurn = burnFrom !== undefined;
  // A route whose source legs are real calls.
  const isReal = isNativeDeposit || isCctpBurn;
  // A CCTP claim is sent on Ethereum by the address it mints to.
  const claimedByOther = isCctpBurn && sendsToOther(recipient, account);
  const needsContractAccept = isCctpBurn && !claimedByOther && !!form.senderIsContract;
  const [contractAccepted, setContractAccepted] = useState(false);
  const contractUnaccepted = needsContractAccept && !contractAccepted;
  // The burn legs refuse it too: only this browser can bring the recipient the claim link again.
  const storageRefused = useMemo(() => claimedByOther && !isStorageWritable(), [claimedByOther]);
  const contractWallet = useMemo(
    () =>
      needsContractAccept ? { accepted: contractAccepted, onAcceptedChange: setContractAccepted } : undefined,
    [needsContractAccept, contractAccepted]
  );
  const ethereumChainId = guardChainId({
    network: 'ethereum',
    familyChainId,
    chainIds: chains.map(chain => chain.id)
  });
  // The session callbacks of the Confirm that started the legs.
  const legCallbacksRef = useRef<TxCallbacks>(txCallbacks);
  // A Safe, or a wallet not known yet not to be one, signs one leg at a time.
  const batch = useShouldUseBatch(safeStatus === 'not-safe');
  // The wallet's id of the bundle it just accepted, set right before the bundle's onStart records it.
  const callsIdRef = useRef<string | undefined>(undefined);
  const sourceClient = usePublicClient({ chainId: pinnedChainId });
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
  const burn = useCctpBurnLegs({
    enabled: isCctpBurn && form.isConnected && (runningBurn !== undefined || !form.reviewBlocked),
    // Any network while disabled.
    from: burnFrom ?? 'base',
    chainId: pinnedChainId,
    ethereumChainId,
    account,
    recipient,
    amount,
    scope,
    resume,
    isSafeApp,
    isSafeWallet: isSafe,
    batch,
    onCallsSent: id => {
      callsIdRef.current = id;
    },
    getCallbacks: () => legCallbacksRef.current
  });
  const legs = isCctpBurn ? burn : deposit;
  const { reset: resetDeposit } = deposit;
  const { reset: resetBurn } = burn;
  const refetchAllowance = isCctpBurn ? burn.refetchAllowance : deposit.refetchAllowance;
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
  const resetRun = useCallback(
    (onCleared?: () => void) => {
      setRunningTo(undefined);
      setRunningBurn(undefined);
      // The reads refresh once the active engine's write still out has landed.
      if (isCctpBurn) {
        resetDeposit();
        resetBurn(onCleared);
      } else {
        resetBurn();
        resetDeposit(onCleared);
      }
    },
    [isCctpBurn, resetDeposit, resetBurn]
  );
  // A run that stopped after its swap or approve mined moved funds on the source chain too.
  const refetchReads = useCallback(() => {
    refetchAllowance();
    if (pinnedChainId !== undefined)
      void queryClient.invalidateQueries({ predicate: readsBalanceOn(pinnedChainId) });
  }, [refetchAllowance, pinnedChainId, queryClient]);
  useResetUnfinishedRunOnClose(resetRun, refetchReads);

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
  // A burn signs one step per call: its approves, the swap to USDC and the burn.
  const burnSteps = useMemo<TransactionStep[]>(
    () =>
      burn.calls.map(call => {
        const { functionName, to: target } = call as { functionName?: string; to?: string };
        if (functionName === 'swapExactIn')
          return {
            label: t`Swap to USDC`,
            tokenSymbol: 'USDS',
            failureDetail: t`The USDS hasn't been swapped.`
          };
        if (functionName === CCTP_BURN_FUNCTION)
          return { label: t`Bridge`, tokenSymbol: 'USDC', failureDetail: t`The USDC hasn't been bridged.` };
        const symbol = target?.toLowerCase() === cctpUsds(burnFrom)?.toLowerCase() ? 'USDS' : 'USDC';
        return { label: t`Approve`, tokenSymbol: symbol, failureDetail: stepFailureDetail.approve(symbol) };
      }),
    [burn.calls, burnFrom]
  );
  const steps = useMemo<TransactionStep[]>(
    () =>
      isCctpBurn && burnSteps.length > 0
        ? burnSteps
        : sourceActions.map(action =>
            action === 'approve'
              ? { label: t`Approve`, tokenSymbol: 'USDS', failureDetail: stepFailureDetail.approve('USDS') }
              : { label: t`Bridge`, tokenSymbol: 'USDS', failureDetail: t`The USDS hasn't been bridged.` }
          ),
    [isCctpBurn, burnSteps, sourceActions]
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
    if (!closed || (runningTo === undefined && runningBurn === undefined) || sentRef.current) return;
    resetRun();
    refetchReads();
  }, [isModalOpen, runningTo, runningBurn, resetRun, refetchReads]);
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
        (isReal && !legs.ready) ||
        feeShort ||
        contractUnaccepted
      ) {
        const prepareError = isReal ? enginePrepareErrorMessage(legs.ready, legs.error) : undefined;
        callbacksRef.current.onError(
          new TransactionRefusedError(prepareError ?? 'The bridge is not ready to send.')
        );
        return;
      }
      if (sentRef.current || unresolvedRef.current) {
        callbacksRef.current.onError(
          unresolvedRef.current
            ? new TransactionRefusedError(
                'The last bridge is still pending. Check it on its card before sending again.'
              )
            : new TransactionRefusedError('The bridge was already sent.', { final: true })
        );
        return;
      }
      if (pinnedChainId !== launchedChainIdRef.current) {
        callbacksRef.current.onError(new TransactionRefusedError('The source network changed after Review.'));
        return;
      }
      if (account !== launchedAccountRef.current) {
        callbacksRef.current.onError(new TransactionRefusedError('The wallet account changed after Review.'));
        return;
      }
      // Snapshot at Confirm: the form may change or reset before the legs finish.
      const record = { account, amount, from, to, recipient, route };
      // A prompt this Confirm opened can be signed after a later Confirm: the modal hears from it only while it is current.
      const isCurrent = () => !isReal || legCallbacksRef.current === callbacks;
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
          legs.stop();
          legCallbacksRef.current = callbacks;
        }
      };
      const recording = withSourceRecording(() => (isCurrent() ? callbacksRef.current : DETACHED), {
        isSafe,
        // The mock names each leg after its step.
        bridgeFunctionName: depositTo
          ? nativeDepositFunction(depositTo)
          : burnFrom
            ? CCTP_BURN_FUNCTION
            : 'send',
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
              // The source chain's client: Ethereum for a deposit, the L2 for a burn.
              const receipt =
                bridge && hash && (await sourceClient?.getTransactionReceipt({ hash: hash as Hex }));
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
          setRunningBurn(undefined);
          // The next bridge's approve depends on what this one spent.
          legs.refetchAllowance();
          if (pinnedChainId !== undefined)
            void queryClient.invalidateQueries({ predicate: readsBalanceOn(pinnedChainId) });
          recording.onSuccess(hash, blockNumber);
        }
      };
      if (depositTo) {
        legCallbacksRef.current = callbacks;
        setRunningTo(depositTo);
        deposit.execute();
      } else if (burnFrom) {
        legCallbacksRef.current = callbacks;
        setRunningBurn(burnFrom);
        burn.execute();
      } else void runMockLegs(sourceActions, () => callbacks);
    };
  });

  const bridgeFee = deposit.maxFee !== undefined ? formatMaxEthFee(deposit.maxFee) : undefined;
  // Gas only; the Arbitrum ticket's ETH is the bridge fee.
  const { data: networkFee } = useNetworkFee({
    calls: legs.calls,
    chainId: pinnedChainId,
    shouldUseBatch: legs.isBatch,
    enabled: isReal && legs.calls.length > 0
  });
  const networkFeeText = networkFee?.formatted ?? NO_VALUE;
  // Arbitrum refunds a contract's unused fee to its L2 alias, which a Safe reaches only through Ethereum.
  const aliasedRefund = isSafe && depositTo === 'arbitrum' && !sendsToOther(recipient, account);
  // A Safe's swap is not kept to continue: its safeTxHash can't be confirmed on chain (APP-567).
  const safeQueue = isSafe && isCctpBurn && !legs.isBatch;
  const addresses = useMemo(
    () =>
      account && recipient && sendsToOther(recipient, account) ? { from: account, to: recipient } : undefined,
    [account, recipient]
  );
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
          addresses={addresses}
          aliasedRefund={aliasedRefund}
          recipientWarning={claimedByOther}
          contractWallet={contractWallet}
          safeQueue={safeQueue}
        />
      ),
    [
      amount,
      from,
      to,
      route,
      networkFeeText,
      bridgeFee,
      addresses,
      aliasedRefund,
      claimedByOther,
      contractWallet,
      safeQueue
    ]
  );
  const transactionScreenContent = useMemo(
    () => <BridgeTransferHero amount={amount} from={from} to={to} testId="bridge-modal-screen-summary" />,
    [amount, from, to]
  );

  const amountLabel = `${formatBigInt(amount, { maxDecimals: 2 })} USDS`;
  const confirmDisabled =
    !form.isConnected ||
    form.reviewBlocked ||
    (isReal && (!legs.ready || legs.busy)) ||
    feeShort ||
    contractUnaccepted;
  // The mock routes send one leg at a time.
  const bundled = isReal && legs.isBatch;
  const feeText = deposit.maxFee !== undefined ? formatEthCeil(deposit.maxFee) : NO_VALUE;
  const errorMessage = storageRefused
    ? t`Browser storage is unavailable here, so this bridge can only go to your own address. Allow site data, or use another browser, to send it to another address.`
    : feeShort && ethBalance
      ? t`You need at least ${feeText} ETH on Ethereum to pay the Arbitrum bridge fee.`
      : isReal && legs.busy
        ? t`A transaction from your last bridge is still open in your wallet or pending. Wait for it to settle before sending again.`
        : isReal
          ? enginePrepareErrorMessage(legs.ready, legs.error)
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
    const title = resume ? t`Continue USDS bridge` : t`Review USDS bridge`;
    // Each Review asks again; its content follows once the modal is open.
    setContractAccepted(false);
    launchModal({
      title,
      transactionTitle: title,
      toast: {
        loading: t`Bridging ${amountLabel}`,
        success: t`Bridge initiated!`,
        error: t`Bridge failed`
      },
      transactionContent,
      transactionScreenContent,
      steps,
      confirmLabel: t`Confirm`,
      confirmDisabled: confirmDisabled || needsContractAccept,
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
    needsContractAccept,
    bundled,
    errorMessage,
    onSuccess,
    sessionId,
    amount,
    pinnedChainId,
    resume
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
