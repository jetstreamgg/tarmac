import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { TxStatus } from '@/widgets';
import { toError } from '@/hooks';
import { getTransactionLink } from '@/utils';
import { toast, toastWithClose } from '@/components/ui/use-toast';
import { MinimizedTransactionToast } from '@/modules/ui/components/MinimizedTransactionToast';
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
      // One transaction at a time: if one is still in-flight (e.g. minimized while
      // awaiting the wallet / mining), don't start a new session — bring the pending
      // one back into view. Launching here would remount the host and strand the
      // running transaction.
      if (txStatusRef.current === TxStatus.INITIALIZED || txStatusRef.current === TxStatus.LOADING) {
        setMinimized(false);
        return;
      }

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
    [chainId, trackWidgetReviewViewed]
  );

  const updateModalContent = useCallback<TransactionContextValue['updateModalContent']>(
    (sessionId, partial) => {
      if (sessionId !== activeSessionRef.current) return;
      setActiveConfig(prev => {
        if (!prev) return prev;
        const { entry: entryPatch, ...rest } = partial;
        const next = { ...prev, ...rest };
        // Merge the entry partial so an in-modal body can flip confirmDisabled /
        // refresh its rows WITHOUT re-pushing `content` (which would remount it).
        // A patch only ever arrives after launch seeded `entry`, so the merge is
        // a complete TransactionEntry.
        if (entryPatch) {
          next.entry = { ...(prev.entry ?? {}), ...entryPatch } as TransactionEntry;
        }
        configRef.current = next;
        return next;
      });
    },
    []
  );

  const resetTransactionProgress = useCallback(() => {
    setExternalLink(undefined);
    setCurrentStep(0);
  }, []);

  const handleClose = useCallback(() => {
    // Track cancellation if the user closes during INITIALIZED (waiting for wallet confirmation)
    const analytics = configRef.current?.analytics;
    if (txStatus === TxStatus.INITIALIZED && analytics) {
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

  const txCallbacks: TxCallbacks = {
    onMutate: useCallback(() => {
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
    }, [chainId, trackTransactionStarted]),

    onStart: useCallback(
      (hash?: string) => {
        setTxStatus(TxStatus.LOADING);
        txStatusRef.current = TxStatus.LOADING;
        if (hash) {
          setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
          txHashRef.current = hash;
        }
      },
      [chainId, address, isSafeWallet]
    ),

    onSuccess: useCallback(
      (hash?: string) => {
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
      [chainId, address, isSafeWallet, trackTransactionCompleted, startNewFlow]
    ),

    onError: useCallback(
      (error: Error, hash?: string) => {
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
      [chainId, address, isSafeWallet, trackTransactionCompleted, startNewFlow]
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
            subtitles={activeConfig.subtitles}
            transactionContent={activeConfig.transactionContent}
            transactionScreenContent={activeConfig.transactionScreenContent}
            entry={activeConfig.entry}
            rightHeaderComponent={activeConfig.rightHeaderComponent}
            titleBadge={activeConfig.titleBadge}
            onConfirm={activeConfig.onConfirm}
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
