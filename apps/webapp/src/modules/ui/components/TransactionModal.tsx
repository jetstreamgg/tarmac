import { useState, useCallback, useRef, ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { TxStatus, Clock, InProgress, SuccessCheck, FailedX, Cancel } from '@/widgets';
import { ChevronLeft } from 'lucide-react';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalTitle
} from '@/components/ui/responsive-modal';
import { Button } from '@/components/ui/button';
import { Steps, StepsItem, type StepState } from '@/components/ui/steps';
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
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import type { TransactionEntry } from '@/modules/ui/context/transactionContract';

// 'entry' is an editable first screen (the body owns its inputs); 'review' is the
// read-only first screen. Both transition to the shared 'transaction' screen.
type TransactionModalStep = 'entry' | 'review' | 'transaction';

/**
 * One entry of a flow's step list. The plain-string form is a bare label; the
 * object form adds the token rendered as an icon+symbol chip after the label
 * (DS Steps pattern, Figma 5200:30561) — e.g. `{ label: "Approve", tokenSymbol:
 * "SKY" }` renders "Approve ◉ SKY".
 */
export type TransactionStep = string | { label: string; tokenSymbol?: string };

export type TransactionSubtitles = {
  review?: string;
  pending?: string;
  loading?: string;
  success?: string;
  error?: string;
};

export type TransactionModalProps = {
  open: boolean;
  /**
   * Registers the entry-screen portal target (a flow's `backgroundContent` portals
   * its editable inputs here). Called with the node on mount and null on unmount.
   */
  registerEntrySlot?: (el: HTMLElement | null) => void;
  onClose: () => void;
  /**
   * Hide the modal while keeping the transaction running. When provided, dismissing
   * the modal mid-flight (close button / esc / click-outside) minimizes instead of
   * being blocked — the transaction continues in the background and a toast tracks it.
   */
  onMinimize?: () => void;
  title: string;
  /** Title for the wallet/status screen; falls back to `title` when omitted. */
  transactionTitle?: string;
  subtitles?: TransactionSubtitles;
  transactionContent?: ReactNode;
  /**
   * Compact body for the wallet/status screen (Figma "Confirm in the wallet").
   * Falls back to `transactionContent` (review path) when omitted, so consumers
   * that don't supply one render unchanged.
   */
  transactionScreenContent?: ReactNode;
  /**
   * Editable first screen. When present the modal opens on the entry screen
   * (the body in `entry.content`) instead of the read-only review.
   */
  entry?: TransactionEntry;
  /** Optional node rendered between the title and the close button — e.g. a slippage gear. */
  rightHeaderComponent?: ReactNode;
  /** Optional badge rendered immediately after the title — e.g. a "Merkl" source chip. */
  titleBadge?: ReactNode;
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
  steps?: TransactionStep[];
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
  registerEntrySlot,
  onClose,
  onMinimize,
  title,
  transactionTitle,
  subtitles,
  transactionContent,
  transactionScreenContent,
  entry,
  rightHeaderComponent,
  titleBadge,
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
  const [batchEnabled] = useBatchToggle();

  const isEntry = step === 'entry';
  const isReview = step === 'review';
  // Both 'entry' and 'review' are first screens: content + a confirm button that
  // advances to the transaction screen. They differ only in content + button source.
  const isFirstScreen = isEntry || isReview;
  const isTransaction = step === 'transaction';
  const hasMultipleSteps = steps && steps.length > 1;
  const showBatchToggle = hasMultipleSteps && batchSupported;
  // Same expression the launch hooks use for `shouldUseBatch` — when true the
  // whole flow is one EIP-5792 bundle, rendered as the DS Bundle variant (all
  // steps active together, "Bundled" header badge).
  const isBundled = !!(hasMultipleSteps && batchEnabled && batchSupported);
  const isTransacting = txStatus === TxStatus.INITIALIZED || txStatus === TxStatus.LOADING;

  // The entry screen sources its label/gating from the entry descriptor (kept
  // live by the in-modal body); the review screen uses the top-level config.
  const firstScreenConfirmLabel = isEntry ? (entry?.confirmLabel ?? confirmLabel) : confirmLabel;
  const firstScreenConfirmDisabled = isEntry ? entry?.confirmDisabled : confirmDisabled;
  // The wallet/status screen shows a compact summary when supplied; otherwise it
  // falls back to the review body (review path only), so consumers that pass only
  // `transactionContent` keep their previous transaction-screen content.
  const transactionScreenBody = transactionScreenContent ?? (entry ? null : transactionContent);

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

  // Stable callback ref so registering the entry slot doesn't thrash on re-render.
  const slotRef = useCallback((el: HTMLDivElement | null) => registerEntrySlot?.(el), [registerEntrySlot]);

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

  // Dismissing the modal: mid-flight it minimizes (the tx keeps running and a toast
  // takes over); otherwise it closes. Used by the close button, esc, and click-outside.
  const handleDismiss = useCallback(() => {
    if (isTransacting && onMinimize) {
      onMinimize();
      return;
    }
    handleClose();
  }, [isTransacting, onMinimize, handleClose]);

  const handleBack = useCallback(() => {
    onBack?.();
    setStep(firstStep);
    setContentHeight(undefined);
  }, [onBack, firstStep]);

  // Header back arrow (Figma chrome on every screen): on the first screen it
  // closes (there's nothing before it — the inputs live on the page/entry); on
  // the wallet/status screen it returns to the first screen. Disabled mid-flight,
  // like the close button.
  const handleHeaderBack = useCallback(() => {
    if (isFirstScreen) {
      handleClose();
    } else {
      handleBack();
    }
  }, [isFirstScreen, handleClose, handleBack]);

  return (
    <ResponsiveModal open={open} onOpenChange={val => !val && handleDismiss()}>
      <ResponsiveModalContent
        aria-describedby={undefined}
        className="bg-containerDark flex flex-col gap-6 p-4 sm:max-w-122.5 sm:min-w-122.5"
        onOpenAutoFocus={e => e.preventDefault()}
        onCloseAutoFocus={e => e.preventDefault()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              aria-label={t`Back`}
              className="text-textSecondary hover:text-text h-8 w-8 rounded-full p-0"
              onClick={handleHeaderBack}
              disabled={isTransacting}
              data-testid="transaction-modal-back"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <ResponsiveModalTitle className="text-text text-2xl">{displayTitle}</ResponsiveModalTitle>
            {/* Source badge sits with the product title (e.g. "Merkl"); hidden once
                the wallet/status screen relabels the title. */}
            {isFirstScreen && titleBadge}
          </div>
          <div className="flex items-center gap-2">
            {rightHeaderComponent}
            <Button
              variant="ghost"
              aria-label={isTransacting ? t`Minimize` : t`Close`}
              className="text-textSecondary hover:text-text h-8 w-8 rounded-full p-0"
              onClick={handleDismiss}
              data-testid="transaction-modal-close"
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

          {/* Step list (DS Steps pattern) — Figma shows it only on the wallet/status
              screen, not on the review/entry screen. Standard flows advance one step
              per tx; bundled flows mark every step active while the single bundle is
              in flight, then complete together. */}
          {hasMultipleSteps && isTransaction && (
            <Steps
              bundled={isBundled}
              badge={txStatus === TxStatus.INITIALIZED ? <Trans>Confirm in the wallet</Trans> : undefined}
            >
              {steps.map((step, i) => {
                const { label, tokenSymbol } = typeof step === 'string' ? { label: step } : step;
                const allDone = txStatus === TxStatus.SUCCESS;
                const state: StepState =
                  allDone || (!isBundled && i < currentStep)
                    ? 'completed'
                    : isBundled || i === currentStep
                      ? 'active'
                      : 'upcoming';

                return (
                  <StepsItem
                    key={i}
                    stepNumber={i + 1}
                    label={label}
                    tokenSymbol={tokenSymbol}
                    tokenIcon={
                      tokenSymbol && (
                        <TokenIcon
                          token={{ symbol: tokenSymbol }}
                          className="h-3.5 w-3.5"
                          showChainIcon={false}
                        />
                      )
                    }
                    state={state}
                    showConnector={i < steps.length - 1}
                  />
                );
              })}
            </Steps>
          )}

          {/* The editable entry body stays MOUNTED for the modal's lifetime — it can
              own the in-flight engine hook whose onSuccess completes the transaction,
              so unmounting it on the transaction screen would strand the modal in
              LOADING. It is only shown on the entry screen (hidden otherwise). */}
          {entry && (
            <div className={isEntry ? 'text-text' : 'hidden'} aria-hidden={!isEntry}>
              {entry.content}
              {/* Portal target for a flow's backgroundContent inputs (see registerEntrySlot). */}
              <div ref={slotRef} />
            </div>
          )}

          {/* Read-only review breakdown (review path) — first screen only. Owns no
              hook, so it can unmount on the transaction screen. */}
          {!entry && isFirstScreen && transactionContent && (
            <div className="text-text">{transactionContent}</div>
          )}

          {/* Compact summary on the wallet/status screen (Figma "Confirm in the
              wallet"): a relabelled amount header in place of the full breakdown. */}
          {isTransaction && transactionScreenBody && <div className="text-text">{transactionScreenBody}</div>}

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
                  variant="primary"
                  size="xl"
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
                    <Button variant="primary" size="xl" className="w-full" loading>
                      <Trans>Waiting for confirmation</Trans>
                    </Button>
                  )}

                  {txStatus === TxStatus.LOADING && (
                    <Button variant="primary" size="xl" className="w-full" loading>
                      <Trans>Processing</Trans>
                    </Button>
                  )}

                  {(txStatus === TxStatus.SUCCESS || txStatus === TxStatus.CANCELLED) && (
                    <Button variant="primary" size="xl" className="w-full" onClick={handleClose}>
                      {successLabel ?? <Trans>Done</Trans>}
                    </Button>
                  )}

                  {txStatus === TxStatus.ERROR && (
                    <div className="flex w-full gap-3">
                      <Button variant="secondary" size="xl" className="flex-1" onClick={handleBack}>
                        <Trans>Back</Trans>
                      </Button>
                      <Button variant="primary" size="xl" className="flex-1" onClick={handleRetry}>
                        {errorLabel ?? <Trans>Retry</Trans>}
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
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
