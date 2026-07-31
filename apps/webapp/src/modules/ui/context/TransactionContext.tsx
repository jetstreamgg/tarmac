import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { TxStatus, InProgress, Cancel } from '@/widgets';
import { toError } from '@/hooks';
import { getTransactionLink } from '@/utils';
import { Trans } from '@lingui/react/macro';
import { toast, toastWithClose } from '@/components/ui/use-toast';
import { MinimizedTransactionToast } from '@/modules/ui/components/MinimizedTransactionToast';
import { TransactionNoticeToast } from '@/modules/ui/components/TransactionNoticeToast';
import { useIsSafeWallet } from '@/hooks';
import { useChainId, useConnection } from 'wagmi';
import { TransactionModal } from '@/modules/ui/components/TransactionModal';
import { useAppAnalytics } from '@/modules/analytics/hooks/useAppAnalytics';
import { useAnalyticsFlow } from '@/modules/analytics/context/AnalyticsFlowContext';
import { reportError } from '@/modules/sentry/reportError';
import { isUserRejectedRequestError } from '@/modules/utils/isUserRejectedRequestError';
import type {
  TransactionConfig,
  TransactionEntry,
  TxCallbacks,
  TransactionContextValue
} from './transactionContract';

// Stable id for the single "transaction running in the background" toast, so repeated
// updates (and StrictMode's double-invoke) replace it rather than stacking.
const MINIMIZED_TOAST_ID = 'transaction-minimized';
const ABANDONED_TOAST_ID = 'transaction-abandoned';
const PENDING_BLOCK_TOAST_ID = 'transaction-pending-block';

// The dapp cannot dismiss a wallet's signature prompt — abandoning a session
// only stops the app from listening. Tell the user to finish the job wallet-side.
function notifyRequestAbandoned() {
  toastWithClose(
    () => (
      <TransactionNoticeToast
        icon={<Cancel />}
        title={<Trans>Transaction request discarded</Trans>}
        description={<Trans>If your wallet still shows the request, reject it there.</Trans>}
      />
    ),
    { id: ABANDONED_TOAST_ID, duration: 8000 }
  );
}

function shouldCaptureTransactionError(error: Error): boolean {
  return !isUserRejectedRequestError(error);
}

// The transaction-orchestration contract is frozen in ./transactionContract.
// Re-exported here so existing import sites keep working.
export type {
  TransactionAnalytics,
  TransactionConfig,
  TransactionEntry,
  TxCallbacks
} from './transactionContract';

const TransactionContext = createContext<TransactionContextValue | null>(null);

// Internal: the DOM node on the modal's entry screen where an editable flow's
// `backgroundContent` portals its visible inputs. This lets the in-flight hook
// host live OUTSIDE the dialog (so it survives minimize) while its inputs still
// display inside it. Null when no entry screen is mounted (e.g. minimized) — the
// host then renders its inputs inline in the hidden background instead.
const EntrySlotContext = createContext<HTMLElement | null>(null);

/** The dialog entry slot to portal editable inputs into, or null when absent. */
export function useEntrySlot() {
  return useContext(EntrySlotContext);
}

export function TransactionProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  // Minimized = modal hidden but the transaction keeps running. Distinct from
  // closed (which tears the transaction down); see minimize()/restore() below.
  const [minimized, setMinimized] = useState(false);
  // The entry-screen portal target, registered by the modal (see EntrySlotContext).
  const [entrySlotEl, setEntrySlotEl] = useState<HTMLElement | null>(null);
  // Bumped on every launch and used as the modal + host `key`, so each launch gets a
  // FRESH mount (screen back to entry, inputs cleared). Minimize keeps the session
  // mounted across the hidden window, so this is the only thing that resets it — a
  // changing key, per the React guidance on resetting all state.
  const [launchCount, setLaunchCount] = useState(0);
  const [txStatus, setTxStatus] = useState<TxStatus>(TxStatus.IDLE);
  const [externalLink, setExternalLink] = useState<string | undefined>();
  const [currentStep, setCurrentStep] = useState(0);
  // Config is state so updateModalContent re-renders the modal; ref mirrors it for callback reads.
  const [activeConfig, setActiveConfig] = useState<TransactionConfig | null>(null);
  const configRef = useRef<TransactionConfig | null>(null);
  const activeSessionRef = useRef<string | null>(null);
  // Session generation: advanced by launch() and handleClose(), so engine
  // callbacks are bound to the session that rendered them (state) and can spot
  // that it has since ended (ref). An in-flight write outlives its host — the
  // wallet can accept in the same instant the user dismisses the modal — and
  // without this check the orphaned engine's onStart stamped LOADING onto the
  // torn-down provider (no modal left to restore), bricking every later
  // launch() on the in-progress guard until a reload; after an
  // abandon-then-relaunch it would corrupt the NEW session instead.
  const [sessionGen, setSessionGen] = useState(0);
  const sessionGenRef = useRef(0);
  // The generation of the write currently in flight, latched at onMutate.
  //
  // The closure check above only sheds a stale callback when the engine is
  // still HOLDING an old render's closure — true for flows hosted in
  // `backgroundContent` (savings, stUSDS, rewards, vault, claim, upgrade,
  // pendle supply/withdraw): close unmounts the host and freezes its closures
  // at the pre-bump generation. The review-first flows (convert, pendle
  // redeem, the stake takeovers) keep their engine host mounted on the page,
  // so it re-renders after teardown and react-query hands the LIVE mutation
  // the newest options (MutationObserver.setOptions pushes into a pending
  // Mutation, and useWriteContractFlow's receipt effect closes over the
  // current render) — a late callback from an abandoned write would arrive
  // carrying the CURRENT generation and sail through.
  //
  // onMutate is the one callback that always fires synchronously from the
  // user's confirm, so the generation it records is the session that actually
  // started the write, whatever the host's mount state. The settle callbacks
  // check that instead of trusting their own closure. Null until the first
  // write of the page's life, where it falls back to the closure check alone.
  const writeGenRef = useRef<number | null>(null);
  // Hash of the write this session is tracking, latched at onStart, so a
  // settle carrying a DIFFERENT hash is recognisable as another transaction's.
  const writeHashRef = useRef<string | undefined>(undefined);
  // Mirrors txStatus for reads inside callbacks (avoids setState-inside-updater impurity).
  const txStatusRef = useRef<TxStatus>(TxStatus.IDLE);
  // Latest on-chain hash, for the minimized toast's shortened-hash subtitle.
  const txHashRef = useRef<string | undefined>(undefined);

  const chainId = useChainId();
  const { address } = useConnection();
  const isSafeWallet = useIsSafeWallet();
  const { trackWidgetReviewViewed, trackTransactionStarted, trackTransactionCompleted } = useAppAnalytics();
  const { startNewFlow } = useAnalyticsFlow();

  const launch = useCallback(
    (config: TransactionConfig) => {
      // One BROADCAST transaction at a time: it's on-chain and will resolve, so
      // don't start a new session — bring the pending modal back into view and
      // say why. Launching here would remount the host and strand the running tx.
      // The configRef check is self-healing defense: LOADING with no live
      // session has nothing to restore, so fall through to a fresh launch
      // instead of blocking forever.
      if (txStatusRef.current === TxStatus.LOADING && configRef.current) {
        setMinimized(false);
        toastWithClose(
          () => (
            <TransactionNoticeToast
              icon={<InProgress />}
              title={<Trans>Transaction in progress</Trans>}
              description={<Trans>It needs to finish before you can start a new one.</Trans>}
            />
          ),
          { id: PENDING_BLOCK_TOAST_ID, duration: 8000 }
        );
        return;
      }

      // A session still awaiting the wallet signature (INITIALIZED) has nothing
      // on-chain — starting a new flow abandons it: track the cancellation, warn
      // about the orphaned wallet prompt, and fall through to a fresh launch
      // (which resets all session state and remounts the hosts).
      if (txStatusRef.current === TxStatus.INITIALIZED) {
        const abandoned = configRef.current?.analytics;
        if (abandoned) {
          trackTransactionCompleted({
            widgetName: abandoned.widgetName,
            chainId,
            txStatus: 'cancelled',
            action: abandoned.action,
            flow: abandoned.flow,
            data: abandoned.data
          });
          startNewFlow();
        }
        notifyRequestAbandoned();
      }

      sessionGenRef.current += 1;
      setSessionGen(sessionGenRef.current);
      configRef.current = config;
      activeSessionRef.current = config.sessionId ?? null;
      setActiveConfig(config);
      setTxStatus(TxStatus.IDLE);
      txStatusRef.current = TxStatus.IDLE;
      setExternalLink(undefined);
      txHashRef.current = undefined;
      setCurrentStep(0);
      setMinimized(false);
      setLaunchCount(c => c + 1);
      setOpen(true);

      // Track review viewed
      if (config.analytics) {
        trackWidgetReviewViewed({
          widgetName: config.analytics.widgetName,
          chainId,
          flow: config.analytics.flow
        });
      }
    },
    [chainId, trackWidgetReviewViewed, trackTransactionCompleted, startNewFlow]
  );

  const updateModalContent = useCallback<TransactionContextValue['updateModalContent']>(
    (sessionId, partial) => {
      if (sessionId !== activeSessionRef.current) return;
      const prev = configRef.current;
      if (!prev) return;
      const { entry: entryPatch, ...rest } = partial;
      const next = { ...prev, ...rest };
      // Merge the entry partial so an in-modal body can flip confirmDisabled /
      // refresh its rows WITHOUT re-pushing `content` (which would remount it).
      // A patch only ever arrives after launch seeded `entry`, so the merge is
      // a complete TransactionEntry.
      if (entryPatch) {
        next.entry = { ...(prev.entry ?? {}), ...entryPatch } as TransactionEntry;
      }
      // The ref is assigned synchronously (not inside the setState updater): a
      // two-action entry pushes the clicked mode's steps/analytics and executes
      // in the same click, and the engine's onMutate — which also fires
      // synchronously — reads analytics off this ref.
      configRef.current = next;
      setActiveConfig(next);
    },
    []
  );

  const resetTransactionProgress = useCallback(() => {
    setExternalLink(undefined);
    setCurrentStep(0);
  }, []);

  const handleClose = useCallback(() => {
    // Closing during INITIALIZED abandons an un-signed session: track the
    // cancellation and warn about the wallet prompt we can't dismiss.
    const analytics = configRef.current?.analytics;
    if (txStatus === TxStatus.INITIALIZED) {
      if (analytics) {
        trackTransactionCompleted({
          widgetName: analytics.widgetName,
          chainId,
          txStatus: 'cancelled',
          action: analytics.action,
          flow: analytics.flow,
          data: analytics.data
        });
        startNewFlow();
      }
      notifyRequestAbandoned();
    }

    // End the session generation FIRST: an engine the wallet already answered
    // may fire callbacks right after this teardown, and they must see
    // themselves as stale (see sessionGen above).
    sessionGenRef.current += 1;
    setSessionGen(sessionGenRef.current);
    setOpen(false);
    setMinimized(false);
    setTxStatus(TxStatus.IDLE);
    txStatusRef.current = TxStatus.IDLE;
    setExternalLink(undefined);
    setCurrentStep(0);
    setActiveConfig(null);
    configRef.current = null;
    activeSessionRef.current = null;
  }, [txStatus, chainId, trackTransactionCompleted, startNewFlow]);

  // Hide the modal without ending the transaction. Unlike handleClose this keeps
  // activeConfig + txStatus intact (and fires no 'cancelled' analytics), so the
  // engine hook keeps running and restore() re-shows the modal mid-flight.
  const minimize = useCallback(() => setMinimized(true), []);
  const restore = useCallback(() => setMinimized(false), []);

  // While minimized the modal is hidden, so surface the transaction's progress as a
  // toast (syncing with the toast system — a legitimate external-system effect). A
  // stable id means StrictMode's double-invoke just updates the toast in place;
  // restoring/closing dismisses it. The toast itself re-opens the modal on click.
  useEffect(() => {
    if (!minimized) {
      toast.dismiss(MINIMIZED_TOAST_ID);
      return;
    }
    const config = configRef.current;
    if (!config) return;
    // Amount-aware title when the flow supplied one, else the subtitle sentence, else the title.
    const titleFor = (state: 'loading' | 'success' | 'error') =>
      config.toast?.[state] ?? config.subtitles?.[state] ?? config.title;

    const inFlight = txStatus === TxStatus.LOADING || txStatus === TxStatus.INITIALIZED;
    const state =
      txStatus === TxStatus.SUCCESS ? 'success' : txStatus === TxStatus.ERROR ? 'error' : 'loading';
    if (txStatus !== TxStatus.SUCCESS && txStatus !== TxStatus.ERROR && !inFlight) return;

    toastWithClose(
      () => (
        <MinimizedTransactionToast
          status={txStatus}
          title={titleFor(state)}
          hash={txHashRef.current}
          onView={() => setMinimized(false)}
        />
      ),
      { id: MINIMIZED_TOAST_ID, duration: inFlight ? Infinity : 10000 }
    );

    return () => {
      toast.dismiss(MINIMIZED_TOAST_ID);
    };
  }, [minimized, txStatus]);

  const handleRetry = useCallback(() => {
    resetTransactionProgress();

    if (configRef.current?.onRetry) {
      configRef.current.onRetry();
      return;
    }

    configRef.current?.onConfirm();
  }, [resetTransactionProgress]);

  // A settle callback belongs to the running session only if BOTH its closure
  // and the write it reports on were made in the current generation (see
  // writeGenRef). Either mismatch means the caller is an engine from a session
  // that was closed or abandoned, and it must drop itself.
  const isStaleWrite = useCallback(
    (gen: number) =>
      gen !== sessionGenRef.current ||
      (writeGenRef.current !== null && writeGenRef.current !== sessionGenRef.current),
    []
  );

  // A settle for a hash other than the one this session broadcast is another
  // transaction's — an abandoned write landing while a new one is in flight.
  // Skipped for Safe wallets, where the two hashes differ legitimately: the
  // engine reports the safeTxHash at onStart and the real transaction hash at
  // onSuccess. `isSafeWallet` is the broader test of the two (it also covers a
  // Safe address reached through another connector), so this only ever errs
  // towards accepting a settle — never towards dropping a real one.
  const isForeignHash = useCallback(
    (hash?: string) => !isSafeWallet && !!hash && !!writeHashRef.current && hash !== writeHashRef.current,
    [isSafeWallet]
  );

  // Each callback closes over the `sessionGen` of the render that created it
  // and drops itself when the generation has moved on — the caller is an
  // engine from a session that was closed or abandoned.
  const txCallbacks: TxCallbacks = {
    onMutate: useCallback(() => {
      if (sessionGen !== sessionGenRef.current) return;
      // Latch the write to this session; the settle callbacks check it. Fires
      // synchronously from the user's confirm, so it can trust its closure.
      writeGenRef.current = sessionGenRef.current;
      writeHashRef.current = undefined;
      // Advance the step from a ref, not inside the setTxStatus updater (StrictMode double-invokes it).
      if (txStatusRef.current === TxStatus.INITIALIZED || txStatusRef.current === TxStatus.LOADING) {
        setCurrentStep(s => s + 1);
      }
      setTxStatus(TxStatus.INITIALIZED);
      txStatusRef.current = TxStatus.INITIALIZED;
      setExternalLink(undefined);
      txHashRef.current = undefined;

      // Track transaction started
      const analytics = configRef.current?.analytics;
      if (analytics) {
        trackTransactionStarted({
          widgetName: analytics.widgetName,
          chainId,
          action: analytics.action,
          flow: analytics.flow,
          data: analytics.data
        });
      }
    }, [sessionGen, chainId, trackTransactionStarted]),

    onStart: useCallback(
      (hash?: string) => {
        if (isStaleWrite(sessionGen)) return;
        writeHashRef.current = hash;
        setTxStatus(TxStatus.LOADING);
        txStatusRef.current = TxStatus.LOADING;
        if (hash) {
          setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
          txHashRef.current = hash;
        }
      },
      [sessionGen, chainId, address, isSafeWallet, isStaleWrite]
    ),

    onSuccess: useCallback(
      (hash?: string) => {
        if (isStaleWrite(sessionGen) || isForeignHash(hash)) return;
        setTxStatus(TxStatus.SUCCESS);
        txStatusRef.current = TxStatus.SUCCESS;
        if (hash) {
          setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
          txHashRef.current = hash;
        }

        // Track transaction completed (success)
        const analytics = configRef.current?.analytics;
        if (analytics) {
          trackTransactionCompleted({
            widgetName: analytics.widgetName,
            chainId,
            txStatus: 'success',
            txHash: hash,
            action: analytics.action,
            flow: analytics.flow,
            data: analytics.data
          });
          startNewFlow();
        }

        configRef.current?.onSuccess?.();
      },
      [
        sessionGen,
        chainId,
        address,
        isSafeWallet,
        trackTransactionCompleted,
        startNewFlow,
        isStaleWrite,
        isForeignHash
      ]
    ),

    onError: useCallback(
      (error: Error, hash?: string) => {
        if (isStaleWrite(sessionGen) || isForeignHash(hash)) return;
        setTxStatus(TxStatus.ERROR);
        txStatusRef.current = TxStatus.ERROR;
        if (hash) {
          setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
          txHashRef.current = hash;
        }

        // Track transaction completed (error)
        const analytics = configRef.current?.analytics;
        if (analytics) {
          trackTransactionCompleted({
            widgetName: analytics.widgetName,
            chainId,
            txStatus: 'error',
            txHash: hash,
            errorContext: error.message,
            action: analytics.action,
            flow: analytics.flow,
            data: analytics.data
          });
          startNewFlow();
        }

        const normalizedError = toError(error);

        if (shouldCaptureTransactionError(normalizedError)) {
          reportError(normalizedError, {
            module: 'transactions',
            flow: analytics?.flow ?? 'unknown',
            action: analytics?.action ?? 'unknown',
            type: 'transaction_error',
            extra: {
              chainId,
              txHash: hash,
              isSafeWallet,
              widget: analytics?.widgetName ?? 'unknown',
              analyticsData: analytics?.data ?? null
            }
          });
        }

        configRef.current?.onError?.();
      },
      [
        sessionGen,
        chainId,
        address,
        isSafeWallet,
        trackTransactionCompleted,
        startNewFlow,
        isStaleWrite,
        isForeignHash
      ]
    )
  };

  return (
    <TransactionContext.Provider
      value={{
        launch,
        updateModalContent,
        isModalOpen: open,
        minimize,
        restore,
        isMinimized: minimized,
        txCallbacks,
        txStatus
      }}
    >
      <EntrySlotContext.Provider value={entrySlotEl}>
        {children}
        {/* In-flight hook host: kept mounted (hidden) for the modal's whole lifetime,
            OUTSIDE the Radix dialog, so minimizing (which unmounts the dialog body)
            never tears down a running transaction. It portals its visible inputs into
            the modal's entry slot when present. See `backgroundContent` in the contract. */}
        {activeConfig?.backgroundContent && (
          <div hidden key={`bg-${launchCount}`}>
            {activeConfig.backgroundContent}
          </div>
        )}
        {activeConfig && (
          <TransactionModal
            key={launchCount}
            open={open && !minimized}
            registerEntrySlot={setEntrySlotEl}
            onClose={handleClose}
            onMinimize={minimize}
            title={activeConfig.title}
            transactionTitle={activeConfig.transactionTitle}
            reviewTitle={activeConfig.reviewTitle}
            subtitles={activeConfig.subtitles}
            transactionContent={activeConfig.transactionContent}
            transactionScreenContent={activeConfig.transactionScreenContent}
            entry={activeConfig.entry}
            rightHeaderComponent={activeConfig.rightHeaderComponent}
            titleBadge={activeConfig.titleBadge}
            onConfirm={activeConfig.onConfirm}
            onSecondaryConfirm={activeConfig.onSecondaryConfirm}
            onRetry={handleRetry}
            onBack={resetTransactionProgress}
            txStatus={txStatus}
            externalLink={externalLink}
            confirmLabel={activeConfig.confirmLabel}
            confirmDisabled={activeConfig.confirmDisabled}
            successLabel={activeConfig.successLabel}
            errorLabel={activeConfig.errorLabel}
            steps={activeConfig.steps}
            currentStep={currentStep}
          />
        )}
      </EntrySlotContext.Provider>
    </TransactionContext.Provider>
  );
}

export function useTransaction() {
  const ctx = useContext(TransactionContext);
  if (!ctx) {
    throw new Error('useTransaction must be used within a TransactionProvider');
  }
  return ctx;
}
