import { useState, useCallback, useRef, ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  TxStatus,
  Clock,
  InProgress,
  SuccessCheck,
  SuccessCheckSolidColor,
  FailedX,
  Cancel
} from '@/widgets';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Close, Info } from '@/modules/icons';
import { Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { Popover, PopoverTrigger, PopoverContent, PopoverClose, PopoverArrow } from '@/components/ui/popover';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { getExplorerName } from '@/utils';
import { useIsSafeWallet } from '@/hooks';
import { useIsBatchSupported } from '@/hooks';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';
import { useChainId } from 'wagmi';
import type { TransactionEntry } from '@/modules/ui/context/transactionContract';

// 'entry' is an editable first screen (the body owns its inputs); 'review' is the
// read-only first screen. Both transition to the shared 'transaction' screen.
type TransactionModalStep = 'entry' | 'review' | 'transaction';

export type TransactionSubtitles = {
  review?: string;
  pending?: string;
  loading?: string;
  success?: string;
  error?: string;
};

export type TransactionModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Title for the wallet/status screen; falls back to `title` when omitted. */
  transactionTitle?: string;
  subtitles?: TransactionSubtitles;
  transactionContent?: ReactNode;
  /**
   * Editable first screen. When present the modal opens on the entry screen
   * (the body in `entry.content`) instead of the read-only review.
   */
  entry?: TransactionEntry;
  /** Optional node rendered between the title and the close button — e.g. a slippage gear. */
  rightHeaderComponent?: ReactNode;
  onConfirm: () => void;
  onRetry?: () => void;
  onBack?: () => void;
  txStatus: TxStatus;
  externalLink?: string;
  confirmLabel?: string;
  /** Disables the Confirm button (e.g. while a quote is refetching). */
  confirmDisabled?: boolean;
  successLabel?: string;
  errorLabel?: string;
  steps?: string[];
  currentStep?: number;
};

const statusIcons: Partial<Record<TxStatus, ReactNode>> = {
  [TxStatus.INITIALIZED]: <Clock />,
  [TxStatus.LOADING]: <InProgress />,
  [TxStatus.SUCCESS]: <SuccessCheck />,
  [TxStatus.ERROR]: <FailedX />,
  [TxStatus.CANCELLED]: <Cancel />
};

const statusMessages: Partial<Record<TxStatus, ReactNode>> = {
  [TxStatus.INITIALIZED]: <Trans>Confirm this transaction in your wallet.</Trans>,
  [TxStatus.LOADING]: <Trans>Transaction is being processed...</Trans>,
  [TxStatus.SUCCESS]: <Trans>Transaction completed successfully.</Trans>,
  [TxStatus.ERROR]: <Trans>Transaction failed. Please try again.</Trans>,
  [TxStatus.CANCELLED]: <Trans>Transaction was cancelled.</Trans>
};

export function TransactionModal({
  open,
  onClose,
  title,
  transactionTitle,
  subtitles,
  transactionContent,
  entry,
  rightHeaderComponent,
  onConfirm,
  onRetry,
  onBack,
  txStatus,
  externalLink,
  confirmLabel,
  confirmDisabled,
  successLabel,
  errorLabel,
  steps,
  currentStep = 0
}: TransactionModalProps) {
  // The first screen is the editable entry when a config supplies one, else the
  // read-only review. Initialised per mount (the provider remounts the modal on
  // each launch, so the initializer sees the launch's `entry`).
  const firstStep: TransactionModalStep = entry ? 'entry' : 'review';
  const [step, setStep] = useState<TransactionModalStep>(firstStep);
  const [contentHeight, setContentHeight] = useState<number | undefined>();
  const reviewRef = useRef<HTMLDivElement>(null);
  const chainId = useChainId();
  const isSafeWallet = useIsSafeWallet();
  const explorerName = getExplorerName(chainId, isSafeWallet);
  const { data: batchSupported } = useIsBatchSupported();

  const isEntry = step === 'entry';
  const isReview = step === 'review';
  // Both 'entry' and 'review' are first screens: content + a confirm button that
  // advances to the transaction screen. They differ only in content + button source.
  const isFirstScreen = isEntry || isReview;
  const isTransaction = step === 'transaction';
  const hasMultipleSteps = steps && steps.length > 1;
  const showBatchToggle = hasMultipleSteps && batchSupported;
  const isTransacting = txStatus === TxStatus.INITIALIZED || txStatus === TxStatus.LOADING;

  // The entry screen sources its label/gating from the entry descriptor (kept
  // live by the in-modal body); the review screen uses the top-level config.
  const firstScreenContent = isEntry ? entry?.content : transactionContent;
  const firstScreenConfirmLabel = isEntry ? (entry?.confirmLabel ?? confirmLabel) : confirmLabel;
  const firstScreenConfirmDisabled = isEntry ? entry?.confirmDisabled : confirmDisabled;

  const subtitleByStatus: Partial<Record<TxStatus, string | undefined>> = {
    [TxStatus.INITIALIZED]: subtitles?.pending,
    [TxStatus.LOADING]: subtitles?.loading,
    [TxStatus.SUCCESS]: subtitles?.success,
    [TxStatus.ERROR]: subtitles?.error
  };
  const subtitle = isFirstScreen ? subtitles?.review : subtitleByStatus[txStatus];

  // The wallet/status screen may carry its own title (e.g. "Confirm in the wallet");
  // falls back to `title` so single-title configs render unchanged on both screens.
  const displayTitle = isTransaction ? (transactionTitle ?? title) : title;

  const handleConfirm = useCallback(() => {
    if (reviewRef.current) {
      setContentHeight(reviewRef.current.offsetHeight);
    }
    setStep('transaction');
    onConfirm();
  }, [onConfirm]);

  const handleRetry = useCallback(() => {
    if (onRetry) {
      onRetry();
    } else {
      onConfirm();
    }
  }, [onConfirm, onRetry]);

  const handleClose = useCallback(() => {
    if (isTransacting) return;
    setStep(firstStep);
    setContentHeight(undefined);
    onClose();
  }, [isTransacting, onClose, firstStep]);

  const handleBack = useCallback(() => {
    onBack?.();
    setStep(firstStep);
    setContentHeight(undefined);
  }, [onBack, firstStep]);

  return (
    <Dialog open={open} onOpenChange={val => !val && handleClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="bg-containerDark flex flex-col gap-6 p-4 sm:max-w-122.5 sm:min-w-122.5"
        onPointerDownOutside={e => isTransacting && e.preventDefault()}
        onEscapeKeyDown={e => isTransacting && e.preventDefault()}
        onOpenAutoFocus={e => e.preventDefault()}
        onCloseAutoFocus={e => e.preventDefault()}
      >
        <div className="flex items-center justify-between">
          <DialogTitle className="text-text text-2xl">{displayTitle}</DialogTitle>
          <div className="flex items-center gap-2">
            {rightHeaderComponent}
            <Button
              variant="ghost"
              className="text-textSecondary hover:text-text h-8 w-8 rounded-full p-0"
              onClick={handleClose}
              disabled={isTransacting}
            >
              <Close className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div
          ref={isFirstScreen ? reviewRef : undefined}
          className="flex flex-col gap-4"
          style={isTransaction ? { minHeight: contentHeight } : undefined}
        >
          {/* Subtitle */}
          <AnimatePresence mode="wait" initial={false}>
            {subtitle && (
              <motion.div
                key={subtitle}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Text className="text-textSecondary">{subtitle}</Text>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step indicators */}
          {hasMultipleSteps && (
            <div className="flex flex-col">
              {steps.map((label, i) => {
                const allDone = isTransaction && txStatus === TxStatus.SUCCESS;
                const isCompleted = isTransaction && (allDone || i < currentStep);
                const isCurrent = isTransaction && !allDone && i === currentStep;
                const stepTxStatus = isCompleted ? TxStatus.SUCCESS : isCurrent ? txStatus : TxStatus.IDLE;

                return (
                  <StepIndicator
                    key={i}
                    stepNumber={i + 1}
                    label={label}
                    txStatus={stepTxStatus}
                    active={isCurrent || (allDone && i === steps.length - 1)}
                  />
                );
              })}
            </div>
          )}

          {/* The editable entry body stays MOUNTED for the modal's lifetime — it can
              own the in-flight engine hook whose onSuccess completes the transaction,
              so unmounting it on the transaction screen would strand the modal in
              LOADING. It is only shown on the entry screen (hidden otherwise). The
              read-only review breakdown owns no hook, so it renders normally. */}
          {entry ? (
            <div className={isEntry ? 'text-text' : 'hidden'} aria-hidden={!isEntry}>
              {entry.content}
            </div>
          ) : (
            firstScreenContent && <div className="text-text">{firstScreenContent}</div>
          )}

          <div className="grow" />

          {/* Bottom section: animates on step/status change */}
          <AnimatePresence mode="wait" initial={false}>
            {isFirstScreen ? (
              <motion.div
                key="review-bottom"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-4"
              >
                {showBatchToggle && <BatchToggle />}
                <Button
                  variant="primaryAlt"
                  className="w-full"
                  onClick={handleConfirm}
                  disabled={firstScreenConfirmDisabled}
                >
                  {firstScreenConfirmLabel ?? <Trans>Confirm</Trans>}
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key={`transaction-${txStatus}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-4"
              >
                <div className="flex items-center gap-3 pt-4">
                  {statusIcons[txStatus] && statusIcons[txStatus]}

                  <div className="flex flex-col">
                    <Text className="text-textSecondary">{statusMessages[txStatus]}</Text>
                    {externalLink && (
                      <ExternalLink
                        href={externalLink}
                        showIcon={false}
                        className="text-text hover:text-text text-sm hover:underline"
                      >
                        <Trans>View on {explorerName}</Trans>
                      </ExternalLink>
                    )}
                  </div>
                </div>

                <div className="w-full">
                  {txStatus === TxStatus.INITIALIZED && (
                    <Button variant="primaryAlt" className="w-full" disabled>
                      <Trans>Waiting for confirmation</Trans>
                    </Button>
                  )}

                  {txStatus === TxStatus.LOADING && (
                    <Button variant="primaryAlt" className="w-full" disabled>
                      <Trans>Processing</Trans>
                    </Button>
                  )}

                  {(txStatus === TxStatus.SUCCESS || txStatus === TxStatus.CANCELLED) && (
                    <Button variant="primaryAlt" className="w-full" onClick={handleClose}>
                      {successLabel ?? <Trans>Done</Trans>}
                    </Button>
                  )}

                  {txStatus === TxStatus.ERROR && (
                    <div className="flex w-full gap-3">
                      <Button variant="outline" className="flex-1" onClick={handleBack}>
                        <Trans>Back</Trans>
                      </Button>
                      <Button variant="primaryAlt" className="flex-1" onClick={handleRetry}>
                        {errorLabel ?? <Trans>Retry</Trans>}
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BatchToggle() {
  const [batchEnabled, setBatchEnabled] = useBatchToggle();

  return (
    <div className="border-selectActive flex items-center gap-4 border-t pt-4">
      <div className="flex flex-wrap items-center gap-1">
        <Text className="text-text text-sm leading-none">
          <Trans>Bundle transactions</Trans>
        </Text>
        <Popover>
          <PopoverTrigger onClick={e => e.stopPropagation()} className="text-text z-10">
            <Info width={13} height={13} />
          </PopoverTrigger>
          <PopoverContent align="center" side="top" className="bg-containerDark backdrop-blur-[50px]">
            <div className="flex items-start justify-between">
              <Text className="text-base font-medium">
                <Trans>Bundle transactions</Trans>
              </Text>
              <PopoverClose onClick={e => e.stopPropagation()}>
                <Close className="text-text h-5 w-5 cursor-pointer" />
              </PopoverClose>
            </div>
            <Text className="light:text-textSecondary mt-2 text-sm text-white/80">
              <Trans>
                Bundled transactions are set &apos;on&apos; by default to complete transactions in a single
                step. Combining actions improves the user experience and reduces gas fees. Manually toggle off
                to cancel this feature.
              </Trans>
            </Text>
            <PopoverArrow />
          </PopoverContent>
        </Popover>
        <Text className="text-textSecondary text-sm leading-none">
          <Trans>(toggled on by default)</Trans>
        </Text>
      </div>
      <Switch
        checked={batchEnabled}
        onCheckedChange={setBatchEnabled}
        aria-label={t`Toggle bundled transactions`}
      />
    </div>
  );
}

function StepIndicator({
  stepNumber,
  label,
  txStatus,
  active
}: {
  stepNumber: number;
  label: string;
  txStatus: TxStatus;
  active: boolean;
}) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <div className="relative inline-flex h-5 w-5 items-center justify-center">
        {active && txStatus === TxStatus.LOADING && (
          <span className="absolute inset-0 flex items-center justify-center">
            <svg className="h-5 w-5 animate-spin text-white" viewBox="0 0 20 20">
              <circle
                className="text-white/30"
                cx="10"
                cy="10"
                r="9"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
              />
              <path className="text-white" fill="none" stroke="currentColor" d="M10 1 A9 9 0 1 1 1 10" />
            </svg>
          </span>
        )}
        <span
          className={`inline-flex h-5 w-5 items-center justify-center rounded-full border-2 text-xs ${
            active
              ? txStatus === TxStatus.LOADING
                ? 'border-transparent text-white'
                : 'border-white text-white'
              : 'border-white/60 text-white/60'
          }`}
        >
          {txStatus === TxStatus.SUCCESS ? <SuccessCheckSolidColor /> : stepNumber}
        </span>
      </div>
      <Text className={active ? 'text-white' : 'text-white/60'}>{label}</Text>
    </div>
  );
}
