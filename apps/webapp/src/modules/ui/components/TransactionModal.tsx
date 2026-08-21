import { useState, useCallback, useRef, ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { TxStatus } from '@/widgets';
import { ArrowLeft } from 'lucide-react';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalTitle
} from '@/components/ui/responsive-modal';
import { Button } from '@/components/ui/button';
import { Steps, StepsItem, StepsBadge } from '@/components/ui/steps';
import { Loader } from '@/components/ui/loader';
import { Close } from '@/modules/icons';
import { Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { getExplorerName } from '@/utils';
import { useIsSafeWallet } from '@/hooks';
import { useIsBatchSupported } from '@/hooks';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';
import { useChainId } from 'wagmi';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { deriveTransactionStepItems, type TransactionStep } from './transactionStepsModel';
import type { TransactionEntry } from '@/modules/ui/context/transactionContract';
import { cn } from '@/lib/cn';

// The step-list shape lives with its derivation; re-exported so the contract and
// launch hooks keep importing it from here.
export type { TransactionStep } from './transactionStepsModel';

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
  /**
   * Title for the read-only review stage of a three-screen flow (e.g. "Review
   * supply"); falls back to `title`. Only read when `entry` and
   * `transactionContent` are both present.
   */
  reviewTitle?: string;
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
  /** Fires for the entry's optional secondary CTA (see `TransactionEntry.secondaryConfirmLabel`). */
  onSecondaryConfirm?: () => void;
  /** Fires when a three-screen flow's entry advances to its review stage. */
  onReviewStage?: () => void;
  onRetry?: () => void;
  onBack?: () => void;
  txStatus: TxStatus;
  externalLink?: string;
  confirmLabel?: string;
  /** Disables the Confirm button (e.g. while a quote is refetching). */
  confirmDisabled?: boolean;
  /**
   * User-readable engine/prepare failure rendered above the review screen's
   * confirm button; the entry screen reads `entry.errorMessage` instead (same
   * dual sourcing as `confirmDisabled`).
   */
  errorMessage?: string;
  successLabel?: string;
  errorLabel?: string;
  steps?: TransactionStep[];
  currentStep?: number;
};

// Figma review (badge restyle, "Confirm in the wallet" 2376:225580): the old
// bottom icon + generic sentence + loading-indicator CTA are gone — the Steps
// badge (multi-step flows) / an equivalent inline chip (single-step flows) is
// now the ONLY place status is shown on this screen. This is the per-status
// source of truth for its label; short chip copy, distinct from `subtitles`
// (which stays the flow-specific sentence rendered above the hero). No IDLE
// entry — the transaction screen isn't reached at that status outside of a
// test harness, and the chip simply stays hidden (see `badgeContent` below).
const statusBadgeLabel: Partial<Record<TxStatus, ReactNode>> = {
  // IDLE is normally a blink — it ends the moment `execute()` fires — but the
  // bottom section swaps through `AnimatePresence mode="wait"`, so a throttled
  // rAF (a backgrounded tab while the user is in their wallet) can hold this
  // frame for seconds. The chip is now the ONLY status surface, so without an
  // entry here that stall paints an empty status area with no icon, text or
  // button. Give it honest in-flight copy rather than a dead screen.
  [TxStatus.IDLE]: <Trans>Preparing</Trans>,
  [TxStatus.INITIALIZED]: <Trans>Confirm in the wallet</Trans>,
  [TxStatus.LOADING]: <Trans>Processing</Trans>,
  [TxStatus.SUCCESS]: <Trans>Success</Trans>,
  [TxStatus.ERROR]: <Trans>Failed</Trans>,
  [TxStatus.CANCELLED]: <Trans>Cancelled</Trans>
};

export function TransactionModal({
  open,
  registerEntrySlot,
  onClose,
  onMinimize,
  title,
  transactionTitle,
  reviewTitle,
  subtitles,
  transactionContent,
  transactionScreenContent,
  entry,
  rightHeaderComponent,
  titleBadge,
  onConfirm,
  onSecondaryConfirm,
  onReviewStage,
  onRetry,
  onBack,
  txStatus,
  externalLink,
  confirmLabel,
  confirmDisabled,
  errorMessage,
  successLabel,
  errorLabel,
  steps,
  currentStep = 0
}: TransactionModalProps) {
  // The first screen is the editable entry when a config supplies one, else the
  // read-only review. Initialised per mount (the provider remounts the modal on
  // each launch, so the initializer sees the launch's `entry`).
  const firstStep: TransactionModalStep = entry ? 'entry' : 'review';
  // A config carrying BOTH an entry and review content is the three-screen flow
  // (Figma 859:36036 → 859:36154 → 859:36214): entry → review → transaction.
  // Entry-only and review-only configs keep their two screens.
  const hasReviewStage = !!(entry && transactionContent);
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
  // Same expression the launch hooks use for `shouldUseBatch` — when true the
  // whole flow is one EIP-5792 bundle, rendered as the DS Bundle variant (all
  // steps active together, "Bundled" header badge).
  const isBundled = !!(hasMultipleSteps && batchEnabled && batchSupported);
  const isTransacting = txStatus === TxStatus.INITIALIZED || txStatus === TxStatus.LOADING;
  // Multi-step failures render inside the step list (retitled step + inline
  // "Try again", Figma 1030:139111) and drop the bottom status row/buttons —
  // the header back arrow still returns to the first screen. Single-step flows
  // have no list, so they keep the bottom treatment.
  const showInlineFailure = !!hasMultipleSteps && isTransaction && txStatus === TxStatus.ERROR;
  // The status chip's content (Figma 2376:225580: leading dots + label). The
  // dots only hop while a status is genuinely in-flight (awaiting signature or
  // pending broadcast) — `isTransacting` already draws exactly that line for
  // the rest of the component, so it's reused here rather than re-derived.
  // Every status the transaction screen can reach now has copy, so the chip
  // always mounts with something; the guard stays as a belt-and-braces against
  // a future status arriving without a label. Dots ride along while the
  // transaction is genuinely in flight, including the IDLE prepare window.
  const badgeContent = statusBadgeLabel[txStatus] ? (
    <>
      {(isTransacting || txStatus === TxStatus.IDLE) && <Loader size="2xs" />}
      {statusBadgeLabel[txStatus]}
    </>
  ) : undefined;

  // The entry screen sources its label/gating from the entry descriptor (kept
  // live by the in-modal body); the review screen uses the top-level config.
  const firstScreenConfirmLabel = isEntry ? (entry?.confirmLabel ?? confirmLabel) : confirmLabel;
  const firstScreenConfirmDisabled = isEntry ? entry?.confirmDisabled : confirmDisabled;
  const firstScreenErrorMessage = isEntry ? entry?.errorMessage : errorMessage;
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

  // The wallet/status screen may carry its own title (e.g. "Confirm in the wallet"),
  // and the three-screen review stage its own (e.g. "Review supply"); both fall back
  // to `title` so single-title configs render unchanged on every screen.
  const displayTitle = isTransaction
    ? (transactionTitle ?? title)
    : isReview && hasReviewStage
      ? (reviewTitle ?? title)
      : title;

  // Stable callback ref so registering the entry slot doesn't thrash on re-render.
  const slotRef = useCallback((el: HTMLDivElement | null) => registerEntrySlot?.(el), [registerEntrySlot]);

  const entryConfirmAction = entry?.confirmAction;
  const handleConfirm = useCallback(() => {
    // An entry-CTA override (e.g. "Connect wallet") runs in place: no screen
    // advance, no onConfirm — see `TransactionEntry.confirmAction`.
    if (isEntry && entryConfirmAction) {
      entryConfirmAction();
      return;
    }
    // In the three-screen flow the entry's confirm only advances to the review —
    // nothing fires on-chain until the review's confirm.
    if (isEntry && hasReviewStage) {
      setStep('review');
      onReviewStage?.();
      return;
    }
    if (reviewRef.current) {
      setContentHeight(reviewRef.current.offsetHeight);
    }
    setStep('transaction');
    onConfirm();
  }, [isEntry, hasReviewStage, onConfirm, entryConfirmAction, onReviewStage]);

  // The entry's secondary CTA (entry-only flows — see the contract): same
  // advance to the wallet screen, firing the secondary action's handler.
  const handleSecondaryConfirm = useCallback(() => {
    if (reviewRef.current) {
      setContentHeight(reviewRef.current.offsetHeight);
    }
    setStep('transaction');
    onSecondaryConfirm?.();
  }, [onSecondaryConfirm]);

  // Two-CTA entry footer (Figma 1036:214001: secondary "Claim" beside primary
  // "Claim & Restake SKY", equal widths). Entry-only flows only — a
  // three-screen entry advances to its single-confirm review.
  const hasSecondaryConfirm =
    isEntry && !hasReviewStage && !!entry?.secondaryConfirmLabel && !!onSecondaryConfirm;

  const handleRetry = useCallback(() => {
    if (onRetry) {
      onRetry();
    } else {
      onConfirm();
    }
  }, [onConfirm, onRetry]);

  // Closing is only blocked while the tx is BROADCAST (LOADING) — a session still
  // awaiting the wallet signature (INITIALIZED) has nothing on-chain, so closing
  // abandons it (the provider tracks the cancel + warns about the wallet prompt).
  const handleClose = useCallback(() => {
    if (txStatus === TxStatus.LOADING) return;
    setStep(firstStep);
    setContentHeight(undefined);
    onClose();
  }, [txStatus, onClose, firstStep]);

  // Dismissing the modal: after broadcast it minimizes (the tx keeps running and a
  // toast takes over); otherwise it closes. Used by the close button, esc, and
  // click-outside.
  const handleDismiss = useCallback(() => {
    if (txStatus === TxStatus.LOADING && onMinimize) {
      onMinimize();
      return;
    }
    handleClose();
  }, [txStatus, onMinimize, handleClose]);

  const handleBack = useCallback(() => {
    onBack?.();
    setStep(firstStep);
    setContentHeight(undefined);
  }, [onBack, firstStep]);

  // Header back arrow (Figma chrome on every screen): on the flow's first screen
  // it closes (there's nothing before it — the inputs live on the page/entry); on
  // a three-screen flow's review it returns to the entry; on the wallet/status
  // screen it returns to the first screen. Disabled mid-flight, like close.
  const handleHeaderBack = useCallback(() => {
    if (isReview && hasReviewStage) {
      setStep('entry');
    } else if (isFirstScreen) {
      handleClose();
    } else {
      handleBack();
    }
  }, [isReview, hasReviewStage, isFirstScreen, handleClose, handleBack]);

  return (
    <ResponsiveModal open={open} onOpenChange={val => !val && handleDismiss()}>
      <ResponsiveModalContent
        // Popovers, tooltips and selects opened from inside the modal are portalled to
        // the document root, so Radix sees a pointer-down on them as outside the dialog
        // and closes it — which killed the transaction when the bundling switch was used.
        onPointerDownOutside={event => {
          // Figma review: click-outside is disabled while a transaction is actually
          // pending (wallet-signature + broadcast window) so an accidental outside
          // click can't dismiss it mid-flight — entry/review stay dismissable.
          if (isTransacting) {
            event.preventDefault();
            return;
          }
          if ((event.target as HTMLElement | null)?.closest('[data-radix-popper-content-wrapper]')) {
            event.preventDefault();
          }
        }}
        aria-describedby={undefined}
        // DS Modal card (Figma 1310:130558 desktop, 1292:63543 mobile):
        // colors/bg/bg-secondary tint at radius-2xl over the frosted scrim at
        // every tier — the mobile comp ships the same bg-overlay +
        // blur-full scrim under the same near-transparent card, and the
        // SheetOverlay carries that frost. Radius only at md+; the mobile
        // bottom Sheet keeps its own top-only rounding. 610px wide with 48px
        // section gaps on the first screens per the comp; the wallet/status
        // screen spaces its sections with per-section padding instead.
        className={cn(
          // app-loader-cover-hidden: a first connect from inside this modal arms
          // the app loader's held cover (APP-515) — the card hides for the play
          // and pops back at reveal; the frosted scrim stays as the backdrop.
          'app-loader-cover-hidden bg-bgSecondary flex flex-col gap-6 p-4 sm:max-w-152.5 sm:min-w-152.5 sm:px-8 sm:pt-7 sm:pb-8 md:rounded-[28px]',
          !isTransaction && 'sm:gap-12'
        )}
        onOpenAutoFocus={e => e.preventDefault()}
        onCloseAutoFocus={e => e.preventDefault()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* DS Button / Icon (Figma 1036:208086): 40px glass circle, 16px glyph.
                The flow's initial screen has no back arrow (Figma 859:36036 draws
                title + close only); later screens gain it. */}
            {step !== firstStep && (
              <Button
                variant="secondary"
                size="iconM"
                aria-label={t`Back`}
                onClick={handleHeaderBack}
                disabled={isTransacting}
                data-testid="transaction-modal-back"
              >
                <ArrowLeft className="size-4" />
              </Button>
            )}
            {/* Label 3 (Figma 1036:208087): Circular 18/22, -0.36 tracking, fg-primary. */}
            <ResponsiveModalTitle className="text-fgPrimary font-circle text-lg leading-5.5 font-medium tracking-[-0.36px]">
              {displayTitle}
            </ResponsiveModalTitle>
            {/* Source badge sits with the product title (e.g. "Merkl"); hidden once
                the wallet/status screen relabels the title. */}
            {isFirstScreen && titleBadge}
          </div>
          <div className="flex items-center gap-2">
            {rightHeaderComponent}
            <Button
              variant="secondary"
              size="iconM"
              aria-label={txStatus === TxStatus.LOADING ? t`Minimize` : t`Close`}
              onClick={handleDismiss}
              data-testid="transaction-modal-close"
            >
              <Close className="size-4" />
            </Button>
          </div>
        </div>

        <div
          ref={isFirstScreen ? reviewRef : undefined}
          className={cn('flex flex-col gap-4', !isTransaction && 'sm:gap-12')}
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

          {/* Read-only review breakdown — the review-path first screen, or the
              three-screen flow's middle stage. Owns no hook, so it can unmount on
              the transaction screen. */}
          {isReview && transactionContent && <div className="text-text">{transactionContent}</div>}

          {/* Compact summary on the wallet/status screen (Figma "Confirm in the
              wallet"): a relabelled amount header in place of the full breakdown. */}
          {/* pt-4/pb-6 + the column gaps = the comp's 40px breathing room around the hero (1310:130564). */}
          {isTransaction && transactionScreenBody && (
            <div className="text-text pt-4 pb-6">{transactionScreenBody}</div>
          )}

          {/* Step list (DS Steps pattern) — wallet/status screen only, drawn BELOW
              the hero behind a hairline divider (Figma confirm comps, 1310:130531).
              The per-row states (including the failure treatment with its inline
              "Try again") come from the derivation in ./transactionStepsModel. */}
          {hasMultipleSteps && isTransaction && (
            <>
              {/* Figma 859:36229: the steps section splits from the hero on a border-primary hairline, 24px above the header. */}
              {transactionScreenBody && <div className="border-borderPrimary border-t" />}
              <Steps className="pt-2" bundled={isBundled} badge={badgeContent}>
                {(() => {
                  const items = deriveTransactionStepItems({
                    steps,
                    currentStep,
                    txStatus,
                    bundled: isBundled
                  });
                  const tryAgain = (
                    <Button variant="primary" size="m" onClick={handleRetry}>
                      {errorLabel ?? <Trans>Try again</Trans>}
                    </Button>
                  );
                  return items.map((item, i) => (
                    <StepsItem
                      key={item.stepNumber}
                      stepNumber={item.stepNumber}
                      label={item.retry === 'slot' ? tryAgain : item.label}
                      tokenSymbol={item.tokenSymbol}
                      tokenIcon={
                        item.tokenSymbol && (
                          <TokenIcon
                            token={{ symbol: item.tokenSymbol }}
                            className="h-3.5 w-3.5"
                            showChainIcon={false}
                          />
                        )
                      }
                      targetTokenSymbol={item.targetTokenSymbol}
                      targetTokenIcon={
                        item.targetTokenSymbol && (
                          <TokenIcon
                            token={{ symbol: item.targetTokenSymbol }}
                            className="h-3.5 w-3.5"
                            showChainIcon={false}
                          />
                        )
                      }
                      state={item.state}
                      description={item.description}
                      trailingAction={item.retry === 'trailing' ? tryAgain : undefined}
                      showConnector={i < items.length - 1}
                    />
                  ));
                })()}
              </Steps>
            </>
          )}

          {/* Pushes the status row/buttons to the held height on the wallet screen.
              A zero-height child still consumes two column gaps, so it must not
              render on the first screens (their card hugs content, Figma 859:36036). */}
          {isTransaction && <div className="grow" />}

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
                {/* Explanatory only — the flow's confirmDisabled does the actual blocking. */}
                {firstScreenErrorMessage && (
                  <div role="alert">
                    <Text className="text-error text-sm" data-testid="transaction-modal-error">
                      {firstScreenErrorMessage}
                    </Text>
                  </div>
                )}
                {hasSecondaryConfirm ? (
                  // Comp 1036:214001: two flex-1 CTAs with a 20px gutter.
                  <div className="flex w-full gap-5">
                    <Button
                      variant="secondary"
                      size="xl"
                      className="flex-1"
                      onClick={handleSecondaryConfirm}
                      disabled={entry?.secondaryConfirmDisabled}
                    >
                      {entry?.secondaryConfirmLabel}
                    </Button>
                    <Button
                      variant="primary"
                      size="xl"
                      className="flex-1"
                      onClick={handleConfirm}
                      disabled={firstScreenConfirmDisabled}
                    >
                      {firstScreenConfirmLabel ?? <Trans>Confirm</Trans>}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="primary"
                    size="xl"
                    className="w-full"
                    onClick={handleConfirm}
                    disabled={firstScreenConfirmDisabled}
                  >
                    {firstScreenConfirmLabel ?? <Trans>Confirm</Trans>}
                  </Button>
                )}
              </motion.div>
            ) : showInlineFailure ? null : (
              <motion.div
                key={`transaction-${txStatus}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-4"
              >
                {/* Status row: the icon + generic sentence are gone (Figma review) —
                    multi-step flows already show the status chip in the Steps header
                    above, so this row is just the explorer link there. Single-step
                    flows have no Steps header, so the chip renders inline here, in
                    the slot the old icon/message/loading-button treatment used to
                    occupy (Figma 2376:225580). */}
                {((!hasMultipleSteps && badgeContent) || externalLink) && (
                  <div className="flex items-center gap-3 pt-4">
                    {!hasMultipleSteps && badgeContent && (
                      <StepsBadge variant="brand" dataTestId="transaction-status-badge">
                        {badgeContent}
                      </StepsBadge>
                    )}
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
                )}

                {/* Terminal-state actions only — the in-flight states (awaiting
                    signature / processing) are pure loading indicators now
                    represented solely by the chip's dots, not a button. */}
                {(txStatus === TxStatus.SUCCESS || txStatus === TxStatus.CANCELLED) && (
                  <div className="w-full">
                    <Button variant="primary" size="xl" className="w-full" onClick={handleClose}>
                      {successLabel ?? <Trans>Done</Trans>}
                    </Button>
                  </div>
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
