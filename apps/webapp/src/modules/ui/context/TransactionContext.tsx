import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { TxStatus } from '@jetstreamgg/sky-widgets';
import { toError } from '@jetstreamgg/sky-hooks';
import { getTransactionLink, useIsSafeWallet } from '@jetstreamgg/sky-utils';
import { useChainId, useConnection } from 'wagmi';
import { TransactionModal, TransactionSubtitles } from '@/modules/ui/components/TransactionModal';
import { useAppAnalytics } from '@/modules/analytics/hooks/useAppAnalytics';
import { useAnalyticsFlow } from '@/modules/analytics/context/AnalyticsFlowContext';
import { reportError } from '@/modules/sentry/reportError';
import { isUserRejectedRequestError } from '@/modules/utils/isUserRejectedRequestError';

function shouldCaptureTransactionError(error: Error): boolean {
  return !isUserRejectedRequestError(error);
}

/** Analytics metadata passed by consumers to attribute events correctly */
export type TransactionAnalytics = {
  /** Widget/page name (e.g. "vaults") */
  widgetName: string;
  /** Transaction flow (e.g. "claim") */
  flow: string;
  /** Specific action within the flow (e.g. "claim") */
  action?: string;
  /** Extra data merged into every analytics event (e.g. module, claimedRewards) */
  data?: Record<string, unknown>;
};

// The config passed by consumers when launching a transaction
export type TransactionConfig = {
  title: string;
  subtitles?: TransactionSubtitles;
  transactionContent?: ReactNode;
  /** Optional node rendered to the right of the title — e.g. a slippage gear. */
  rightHeaderComponent?: ReactNode;
  onConfirm: () => void;
  onRetry?: () => void;
  confirmLabel?: string;
  successLabel?: string;
  errorLabel?: string;
  onSuccess?: () => void;
  onError?: () => void;
  /** Step labels for multi-step transactions (e.g. ["Approve", "Supply"]) */
  steps?: string[];
  /** Analytics metadata for tracking transaction lifecycle events */
  analytics?: TransactionAnalytics;
};

// Transaction lifecycle callbacks compatible with both WriteHookParams and BatchWriteHookParams
export type TxCallbacks = {
  onMutate: () => void;
  onStart: (hash?: string) => void;
  onSuccess: (hash?: string) => void;
  onError: (error: Error, hash?: string) => void;
};

type TransactionContextValue = {
  /** Open the transaction modal with a review screen */
  launch: (config: TransactionConfig) => void;
  /** Transaction lifecycle callbacks to spread into write hooks */
  txCallbacks: TxCallbacks;
  /** Current transaction status */
  txStatus: TxStatus;
};

const TransactionContext = createContext<TransactionContextValue | null>(null);

export function TransactionProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [txStatus, setTxStatus] = useState<TxStatus>(TxStatus.IDLE);
  const [externalLink, setExternalLink] = useState<string | undefined>();
  const [currentStep, setCurrentStep] = useState(0);
  const configRef = useRef<TransactionConfig | null>(null);

  const chainId = useChainId();
  const { address } = useConnection();
  const isSafeWallet = useIsSafeWallet();
  const { trackWidgetReviewViewed, trackTransactionStarted, trackTransactionCompleted } = useAppAnalytics();
  const { startNewFlow } = useAnalyticsFlow();

  const launch = useCallback(
    (config: TransactionConfig) => {
      configRef.current = config;
      setTxStatus(TxStatus.IDLE);
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
    setExternalLink(undefined);
    setCurrentStep(0);
    configRef.current = null;
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
      setTxStatus(prev => {
        // If already transacting, this is the next step in a sequential flow
        if (prev === TxStatus.INITIALIZED || prev === TxStatus.LOADING) {
          setCurrentStep(s => s + 1);
        }
        return TxStatus.INITIALIZED;
      });
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
        if (hash) {
          setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
        }
      },
      [chainId, address, isSafeWallet]
    ),

    onSuccess: useCallback(
      (hash?: string) => {
        setTxStatus(TxStatus.SUCCESS);
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

  const config = configRef.current;

  return (
    <TransactionContext.Provider value={{ launch, txCallbacks, txStatus }}>
      {children}
      {config && (
        <TransactionModal
          open={open}
          onClose={handleClose}
          title={config.title}
          subtitles={config.subtitles}
          transactionContent={config.transactionContent}
          rightHeaderComponent={config.rightHeaderComponent}
          onConfirm={config.onConfirm}
          onRetry={handleRetry}
          onBack={resetTransactionProgress}
          txStatus={txStatus}
          externalLink={externalLink}
          confirmLabel={config.confirmLabel}
          successLabel={config.successLabel}
          errorLabel={config.errorLabel}
          steps={config.steps}
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
