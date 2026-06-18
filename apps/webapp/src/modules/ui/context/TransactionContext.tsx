import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { TxStatus } from '@/widgets';
import { toError } from '@/hooks';
import { getTransactionLink } from '@/utils';
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

export function TransactionProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [txStatus, setTxStatus] = useState<TxStatus>(TxStatus.IDLE);
  const [externalLink, setExternalLink] = useState<string | undefined>();
  const [currentStep, setCurrentStep] = useState(0);
  // Config is state so updateModalContent re-renders the modal; ref mirrors it for callback reads.
  const [activeConfig, setActiveConfig] = useState<TransactionConfig | null>(null);
  const configRef = useRef<TransactionConfig | null>(null);
  const activeSessionRef = useRef<string | null>(null);
  // Mirrors txStatus for reads inside callbacks (avoids setState-inside-updater impurity).
  const txStatusRef = useRef<TxStatus>(TxStatus.IDLE);

  const chainId = useChainId();
  const { address } = useConnection();
  const isSafeWallet = useIsSafeWallet();
  const { trackWidgetReviewViewed, trackTransactionStarted, trackTransactionCompleted } = useAppAnalytics();
  const { startNewFlow } = useAnalyticsFlow();

  const launch = useCallback(
    (config: TransactionConfig) => {
      configRef.current = config;
      activeSessionRef.current = config.sessionId ?? null;
      setActiveConfig(config);
      setTxStatus(TxStatus.IDLE);
      txStatusRef.current = TxStatus.IDLE;
      setExternalLink(undefined);
      setCurrentStep(0);
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
    setTxStatus(TxStatus.IDLE);
    txStatusRef.current = TxStatus.IDLE;
    setExternalLink(undefined);
    setCurrentStep(0);
    setActiveConfig(null);
    configRef.current = null;
    activeSessionRef.current = null;
  }, [txStatus, chainId, trackTransactionCompleted, startNewFlow]);

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
      value={{ launch, updateModalContent, isModalOpen: open, txCallbacks, txStatus }}
    >
      {children}
      {activeConfig && (
        <TransactionModal
          open={open}
          onClose={handleClose}
          title={activeConfig.title}
          subtitles={activeConfig.subtitles}
          transactionContent={activeConfig.transactionContent}
          entry={activeConfig.entry}
          rightHeaderComponent={activeConfig.rightHeaderComponent}
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
