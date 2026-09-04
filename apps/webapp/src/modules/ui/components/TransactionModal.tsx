import { useState, useCallback, useEffect, useRef, ReactNode } from 'react';
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
import { useIsBatchSupported } from '@/hooks';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { ModalStepBackSlot, ModalStepDivider, ModalStepLabel } from './ModalStepChrome';
import { ModalStepCarrier, type ModalStepCarrierLayer } from './ModalStepCarrier';
import {
  MODAL_LAYER_SHIFT_PX,
  modalEnterTransition,
  modalExitTransition
} from '@/modules/ui/animation/modalStepMotion';
import { TriangleAlert } from 'lucide-react';
import { deriveTransactionStepItems, type TransactionStep } from './transactionStepsModel';
import type { TransactionEntry } from '@/modules/ui/context/transactionContract';
import type { GateStatusCopy, TransactionPreflight } from '@/modules/ui/context/preTransactionGate';
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
  /**
   * Registers the modal's back-to-first-screen action while mounted (null on
   * unmount). The pre-transaction gate drives it on an enhanced-screening
   * denial (APP-517): the first screen — where the preflight renders the
   * blocked message above the disabled CTAs — is that denial's surface.
   */
  registerReturnToFirstScreen?: (fn: (() => void) | null) => void;
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
  /**
   * A step of this flow has mined. From here the run must resume, never reopen
   * the inputs, so Back is withheld: the header arrow stays disabled and the
   * failure screen offers Retry alone (APP-448).
   */
  backLocked?: boolean;
  txStatus: TxStatus;
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
  /**
   * Gate-owned status copy (APP-501): while set, replaces the status row's
   * message and the status-keyed subtitle — the flow's copy narrates on-chain
   * writes, which is wrong while the gate is screening or collecting the
   * terms signature.
   */
  gateCopy?: GateStatusCopy | null;
  /**
   * Enhanced-screening preflight for $250k+ transactions (APP-517). While not
   * 'clear', the CTAs that would FIRE the transaction are held (pending →
   * loading, blocked → disabled with the message rendered above them); CTAs
   * that only advance screens (a three-screen entry's Review) stay live.
   */
  preflight?: TransactionPreflight;
  /**
   * Cross-chain-calldata guard (APP-528). Non-null while the connected wallet is
   * on a chain outside the flow's `supportedChainIds`: every first-screen CTA
   * (advance and fire alike) is disabled and this explanatory block — with a
   * "Switch to <network>" action when the wallet can switch — takes their place,
   * so a product address resolved on another chain can never be sent here.
   */
  chainGuard?: ChainGuard | null;
  /**
   * No first screen (see `TransactionConfig.skipReview`): the modal mounts on
   * the wallet/status screen and fires `onConfirm` itself, once, on mount —
   * the gated path, exactly as a review Confirm would. With nothing to go
   * back to, the failure view offers Retry alone (the provider closes the
   * modal on a gate's return-to-first-screen).
   */
  skipReview?: boolean;
};

/** The transaction modal's chain-guard descriptor (see `chainGuard` prop). */
export type ChainGuard = {
  /** Name of the chain the wallet is wrongly on (may be undefined if unknown). */
  currentName?: string;
  /** Name of the chain to switch to; undefined when none is offerable. */
  targetName?: string;
  /** Switches the wallet to the supported chain; undefined for Safe wallets. */
  onSwitch?: () => void;
  /** True while the wallet is answering the guard's own switch request. */
  switching?: boolean;
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
  // The failed chip swaps to the status-error treatment and leads with the
  // alert triangle (Figma 2800:91683) — see `badgeContent` below.
  [TxStatus.ERROR]: <Trans>Transaction failed</Trans>,
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
  backLocked = false,
  txStatus,
  confirmLabel,
  confirmDisabled,
  errorMessage,
  successLabel,
  errorLabel,
  steps,
  currentStep = 0,
  gateCopy,
  preflight,
  chainGuard,
  registerReturnToFirstScreen,
  skipReview = false
}: TransactionModalProps) {
  // The first screen is the editable entry when a config supplies one, else the
  // read-only review — or, for a flow whose own surface was the review, the
  // wallet/status screen itself. Initialised per mount (the provider remounts
  // the modal on each launch, so the initializer sees the launch's `entry`).
  const firstStep: TransactionModalStep = entry ? 'entry' : skipReview ? 'transaction' : 'review';
  // A config carrying BOTH an entry and review content is the three-screen flow
  // (Figma 859:36036 → 859:36154 → 859:36214): entry → review → transaction.
  // Entry-only and review-only configs keep their two screens.
  const hasReviewStage = !!(entry && transactionContent);
  const [step, setStep] = useState<TransactionModalStep>(firstStep);
  const { data: batchSupported } = useIsBatchSupported();
  const [batchEnabled] = useBatchToggle();

  const isEntry = step === 'entry';
  const isReview = step === 'review';
  // Both 'entry' and 'review' are first screens: content + a confirm button that
  // advances to the transaction screen. They differ only in content + button source.
  const isFirstScreen = isEntry || isReview;
  const isTransaction = step === 'transaction';
  const hasMultipleSteps = steps && steps.length > 1;
  // A gate-mounted signature prelude must be visible even when it is the ONLY
  // step (flows like the claim panel launch without a steps array): the step
  // row is where its explanatory copy, links, and inline retry live (APP-501).
  const hasSignatureStep = !!steps?.some(step => typeof step === 'object' && step.kind === 'signature');
  const showStepList = !!hasMultipleSteps || hasSignatureStep;
  // Same expression the launch hooks use for `shouldUseBatch` — when true the
  // whole flow is one EIP-5792 bundle, rendered as the DS Bundle variant (all
  // steps active together, "Bundled" header badge).
  const isBundled = !!(hasMultipleSteps && batchEnabled && batchSupported);
  const isTransacting = txStatus === TxStatus.INITIALIZED || txStatus === TxStatus.LOADING;
  // Multi-step failures render inside the step list (retitled step + inline
  // "Try again", Figma 1030:139111) and drop the bottom status row/buttons —
  // the header back arrow still returns to the first screen. Single-step flows
  // have no list, so they keep the bottom treatment.
  const showInlineFailure = showStepList && isTransaction && txStatus === TxStatus.ERROR;
  // The status chip's content (Figma 2376:225580: leading dots + label). The
  // dots only hop while a status is genuinely in-flight (awaiting signature or
  // pending broadcast) — `isTransacting` already draws exactly that line for
  // the rest of the component, so it's reused here rather than re-derived.
  // Every status the transaction screen can reach now has copy, so the chip
  // always mounts with something; the guard stays as a belt-and-braces against
  // a future status arriving without a label. Dots ride along while the
  // transaction is genuinely in flight, including the IDLE prepare window.
  // A gate phase owns the label while it holds the floor: both of its phases
  // render as INITIALIZED, so a purely txStatus-keyed chip announces "Confirm
  // in the wallet" during an HTTP address check (APP-501).
  const badgeFailed = txStatus === TxStatus.ERROR;
  // A declined/failed terms signature is not a transaction — nothing reached
  // the chain — so the chip names the signature rather than claiming a
  // rolled-back transaction (the failed row below already says as much).
  const failedStep = steps?.[currentStep];
  const failedOnSignature =
    badgeFailed && typeof failedStep === 'object' && failedStep !== null && failedStep.kind === 'signature';
  const badgeLabel =
    gateCopy?.badgeLabel ??
    (failedOnSignature ? <Trans>Signature failed</Trans> : statusBadgeLabel[txStatus]);
  const badgeVariant = badgeFailed ? 'error' : 'brand';
  const badgeContent = badgeLabel ? (
    <>
      {(isTransacting || txStatus === TxStatus.IDLE) && <Loader size="2xs" />}
      {badgeFailed && <TriangleAlert className="size-3 shrink-0" aria-hidden="true" />}
      {badgeLabel}
    </>
  ) : undefined;

  // The entry screen sources its label/gating from the entry descriptor (kept
  // live by the in-modal body); the review screen uses the top-level config.
  const firstScreenConfirmLabel = isEntry ? (entry?.confirmLabel ?? confirmLabel) : confirmLabel;
  // The CTA element itself survives entry → review (both are first screens), so
  // only its wording rolls — keyed on the step so a live label edit mid-screen
  // doesn't (Figma 2685:148222 rolls "Review" up into "Continue").
  const firstScreenConfirmLabelNode = (
    <ModalStepLabel labelKey={step} align="center">
      {firstScreenConfirmLabel ?? <Trans>Confirm</Trans>}
    </ModalStepLabel>
  );
  // The chain guard (APP-528) disables EVERY first-screen CTA — advancing ones
  // too, not just the firing one — so a wrong-chain flow can't even reach its
  // review. It takes precedence over the flow's own gating, hence the `||`.
  const chainGuarded = !!chainGuard;
  const firstScreenConfirmDisabled = (isEntry ? entry?.confirmDisabled : confirmDisabled) || chainGuarded;
  // Which first-screen primary CTA actually FIRES the transaction: the review
  // confirm, or an entry-only flow's confirm. A three-screen entry's confirm
  // only advances to the review (and a `confirmAction` override runs in
  // place), so neither is held by the preflight — the review's confirm is.
  const primaryConfirmFiresTx = isReview || (isEntry && !entry?.confirmAction && !hasReviewStage);
  // Enhanced-screening hold (APP-517): blocked disables the firing CTAs (the
  // message renders above them); pending renders them in the DS loading state
  // unless something else already disables them.
  const preflightBlocked = preflight?.kind === 'blocked';
  const preflightPending = preflight?.kind === 'pending';
  // Cross-chain-calldata guard (APP-528): the wallet is on a chain this product
  // isn't on. The explanation renders above the CTA row — on the first screen
  // and on the failure view, whose Retry would fire too — and the flow's own
  // primary CTA is REPLACED by the switch action (one button, not a second one
  // beside a disabled Confirm). The switch has no path to the executor, and
  // the provider refuses a wrong-chain fire at the gate anyway; when the wallet
  // can't switch (Safe), the flow's CTAs stay, disabled, under the message.
  const chainGuardBlock = chainGuard && (
    <div className="flex items-start gap-2" data-testid="transaction-chain-guard">
      <TriangleAlert className="text-error mt-0.5 size-4 shrink-0" />
      <Text className="text-error text-sm">
        {chainGuard.targetName ? (
          <Trans>
            This product isn&rsquo;t available on {chainGuard.currentName ?? t`this network`}. Switch to{' '}
            {chainGuard.targetName} to continue.
          </Trans>
        ) : (
          <Trans>
            This product isn&rsquo;t available on {chainGuard.currentName ?? t`this network`}. Switch networks
            to continue.
          </Trans>
        )}
      </Text>
    </div>
  );
  const guardCta =
    chainGuard?.onSwitch && chainGuard.targetName ? (
      <Button
        variant="primary"
        size="xl"
        className="w-full"
        onClick={chainGuard.onSwitch}
        loading={chainGuard.switching}
        data-testid="transaction-chain-guard-switch"
      >
        <Trans>Switch to {chainGuard.targetName}</Trans>
      </Button>
    ) : null;
  // A three-screen flow guarded on its review goes back to the entry: the
  // review's summary (amounts, product address, fee) was built for the chain
  // the wallet just left, and the entry is where the form re-resolves.
  useEffect(() => {
    if (chainGuarded && isReview && hasReviewStage) setStep('entry');
  }, [chainGuarded, isReview, hasReviewStage]);
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
  // A gate phase (screening / terms signature) narrates itself through its
  // subtitle only where there is no step list: with one, the signature step's
  // own row already says what is being waited on, and the flow's status
  // subtitle stays hidden too (it narrates an on-chain write that hasn't
  // started). Figma review 2829:141029: nothing beyond a step's description.
  // The gate's copy is redundant only when the signature prelude step is in
  // the list — that step carries its own description (Figma 2829:141028/9).
  // Screening has no step of its own, so its "Running a quick check…" /
  // "Verifying your wallet address…" copy still shows under a step list.
  const gateCopyInStepList = showStepList && hasSignatureStep;
  const gateSubtitle = gateCopy && !gateCopyInStepList ? gateCopy.subtitle : undefined;
  const subtitle = isFirstScreen ? subtitles?.review : gateCopy ? gateSubtitle : subtitleByStatus[txStatus];
  const firstScreenSubtitle = isFirstScreen ? subtitle : undefined;

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
    setStep('transaction');
    onConfirm();
  }, [isEntry, hasReviewStage, onConfirm, entryConfirmAction, onReviewStage]);

  // The entry's secondary CTA (entry-only flows — see the contract): same
  // advance to the wallet screen, firing the secondary action's handler.
  const handleSecondaryConfirm = useCallback(() => {
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
  }, [onBack, firstStep]);

  // Hand the provider the same back-to-first-screen the header arrow uses, so
  // the gate's returnToFirstScreen control (enhanced-screening denials) lands
  // on an identical screen state — onBack's progress reset included. (For a
  // skipReview flow the provider closes the modal instead — there is no first
  // screen to return to.)
  useEffect(() => {
    registerReturnToFirstScreen?.(handleBack);
    return () => registerReturnToFirstScreen?.(null);
  }, [registerReturnToFirstScreen, handleBack]);

  // A skipReview launch is the review's Confirm: fire once on mount, through
  // the same gated `onConfirm` the review CTA uses. The ref (not the effect)
  // is the once-guard — StrictMode replays mount effects on the same
  // instance, and a second run would be a second transaction under a
  // synchronous gate.
  const autoConfirmedRef = useRef(false);
  useEffect(() => {
    if (!skipReview || autoConfirmedRef.current) return;
    autoConfirmedRef.current = true;
    onConfirm();
    // Mount-only by design: the launch is the click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // One layer per screen for the height carrier. A layer is listed only while its
  // screen is current — AnimatePresence holds the outgoing one for the length of
  // its exit, so nothing has to stay in the array to animate away.
  const bodyLayers: ModalStepCarrierLayer[] = [];
  if (entry) {
    bodyLayers.push({
      key: 'entry',
      // The editable entry body stays MOUNTED for the modal's lifetime — it can own
      // the in-flight engine hook whose onSuccess completes the transaction, so
      // unmounting it on the transaction screen would strand the modal in LOADING.
      persistent: true,
      className: 'text-text',
      content: (
        <>
          {entry.content}
          {/* Portal target for a flow's backgroundContent inputs (see registerEntrySlot). */}
          <div ref={slotRef} />
        </>
      )
    });
  }
  // Read-only review breakdown — the review-path first screen, or the three-screen
  // flow's middle stage. Owns no hook, so it can unmount on the transaction screen.
  if (isReview && transactionContent) {
    bodyLayers.push({ key: 'review', className: 'text-text', content: transactionContent });
  }
  if (isTransaction) {
    bodyLayers.push({
      key: 'transaction',
      className: 'text-text flex flex-col gap-4',
      content: (
        <>
          {/* Compact summary on the wallet/status screen (Figma "Confirm in the
              wallet"): a relabelled amount header in place of the full breakdown.
              pt-4/pb-6 + the column gaps = the comp's 40px breathing room around
              the hero (1310:130564). */}
          {transactionScreenBody && <div className="pt-4 pb-6">{transactionScreenBody}</div>}

          {/* Step list (DS Steps pattern) — wallet/status screen only, drawn BELOW
              the hero behind a hairline divider (Figma confirm comps, 1310:130531).
              The per-row states (including the failure treatment with its inline
              "Try again") come from the derivation in ./transactionStepsModel. */}
          {showStepList && (
            <>
              {/* Figma 859:36229: the steps section splits from the hero on a
                  border-primary hairline, 24px above the header. It draws itself in
                  from the left as the Actions panel arrives (2685:148222 animates
                  the same rule as a path length). */}
              {transactionScreenBody && <ModalStepDivider />}
              <Steps className="pt-2" bundled={isBundled} badge={badgeContent} badgeVariant={badgeVariant}>
                {(() => {
                  const items = deriveTransactionStepItems({
                    steps: steps ?? [],
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
        </>
      )
    });
  }

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
        <div className={cn('flex justify-between', firstScreenSubtitle ? 'items-start' : 'items-center')}>
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {/* No row gap: the back-arrow slot owns the 16px gutter so it can
                collapse to nothing on the first screen, and the badge carries its
                own. That is what lets the title slide sideways instead of jumping
                when the arrow appears (Figma 2685:148222). */}
            <div className="flex min-w-0 items-center">
              {/* DS Button / Icon (Figma 1036:208086): 40px glass circle, 16px glyph.
                The flow's initial screen has no back arrow (Figma 859:36036 draws
                title + close only); later screens gain it. */}
              <ModalStepBackSlot open={step !== firstStep}>
                <Button
                  variant="secondary"
                  size="iconM"
                  aria-label={t`Back`}
                  onClick={handleHeaderBack}
                  disabled={isTransacting || backLocked}
                  data-testid="transaction-modal-back"
                >
                  <ArrowLeft className="size-4" />
                </Button>
              </ModalStepBackSlot>
              {/* Label 3 (Figma 1036:208087): Circular 18/22, -0.36 tracking, fg-primary. */}
              <ResponsiveModalTitle className="text-fgPrimary font-circle min-w-0 text-lg leading-5.5 font-medium tracking-[-0.36px]">
                {/* Keyed on the step, not the string: a live `updateModalContent`
                    retitle mid-screen should not roll. */}
                <ModalStepLabel labelKey={step}>{displayTitle}</ModalStepLabel>
              </ResponsiveModalTitle>
              {/* Source badge sits with the product title (e.g. "Merkl"); hidden once
                the wallet/status screen relabels the title. */}
              {isFirstScreen && titleBadge && <div className="ml-4 shrink-0">{titleBadge}</div>}
            </div>
            {/* Body 6 (Figma 2413:67012): a flow's pre-transaction disclosure hugs
                the title inside the header block, 12/18 on fg-secondary. The
                status subtitles below keep the content column's treatment. */}
            {firstScreenSubtitle && (
              <Text
                variant="captionSm"
                className="text-fgSecondary leading-[18px]"
                dataTestId="transaction-modal-subtitle"
              >
                {firstScreenSubtitle}
              </Text>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
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

        <div className={cn('flex flex-col gap-4', !isTransaction && 'sm:gap-12')}>
          {/* Subtitle */}
          <AnimatePresence mode="wait" initial={false}>
            {subtitle && !isFirstScreen && (
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

          {/* Every screen's body lives in one height-animating box, so a step
              change eases the modal between their heights while they cross-fade
              inside it, instead of snapping (Figma 2685:148222). */}
          <ModalStepCarrier activeKey={step} layers={bodyLayers} />

          {/* Bottom section: animates on step/status change */}
          <AnimatePresence mode="wait" initial={false}>
            {isFirstScreen ? (
              <motion.div
                key="review-bottom"
                initial={{ opacity: 0, y: MODAL_LAYER_SHIFT_PX }}
                animate={{ opacity: 1, y: 0 }}
                // Figma 2685:148222: the CTA does not cross-fade into the Actions
                // panel — it drops out of the modal on the accelerate curve and the
                // panel takes the space it left.
                exit={{ opacity: 0, y: MODAL_LAYER_SHIFT_PX, transition: modalExitTransition }}
                transition={modalEnterTransition}
                className="flex flex-col gap-4"
              >
                {/* Precedes the screening block — a wrong chain is the more
                    fundamental block. */}
                {chainGuardBlock}
                {/* Enhanced-screening failure (APP-517): rendered above the CTAs,
                    which stay visible but disabled — the transaction is blocked. */}
                {preflight?.kind === 'blocked' && (
                  <div className="flex items-start gap-2" data-testid="transaction-preflight-blocked">
                    <TriangleAlert className="text-error mt-0.5 size-4 shrink-0" />
                    <Text className="text-error text-sm">{preflight.message}</Text>
                  </div>
                )}
                {/* Explanatory only — the flow's confirmDisabled does the actual blocking. */}
                {firstScreenErrorMessage && (
                  <div role="alert">
                    <Text className="text-error text-sm" data-testid="transaction-modal-error">
                      {firstScreenErrorMessage}
                    </Text>
                  </div>
                )}
                {chainGuarded && guardCta ? (
                  guardCta
                ) : hasSecondaryConfirm ? (
                  // Comp 1036:214001: two flex-1 CTAs with a 20px gutter.
                  <div className="flex w-full gap-5">
                    <Button
                      variant="secondary"
                      size="xl"
                      className="flex-1"
                      onClick={handleSecondaryConfirm}
                      disabled={entry?.secondaryConfirmDisabled || preflightBlocked || chainGuarded}
                      loading={!entry?.secondaryConfirmDisabled && !chainGuarded && preflightPending}
                    >
                      {entry?.secondaryConfirmLabel}
                    </Button>
                    <Button
                      variant="primary"
                      size="xl"
                      className="flex-1"
                      onClick={handleConfirm}
                      disabled={firstScreenConfirmDisabled || (primaryConfirmFiresTx && preflightBlocked)}
                      loading={primaryConfirmFiresTx && !firstScreenConfirmDisabled && preflightPending}
                    >
                      {firstScreenConfirmLabelNode}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="primary"
                    size="xl"
                    className="w-full"
                    onClick={handleConfirm}
                    disabled={firstScreenConfirmDisabled || (primaryConfirmFiresTx && preflightBlocked)}
                    loading={primaryConfirmFiresTx && !firstScreenConfirmDisabled && preflightPending}
                  >
                    {firstScreenConfirmLabelNode}
                  </Button>
                )}
              </motion.div>
            ) : showInlineFailure ? null : (
              <motion.div
                key={`transaction-${txStatus}`}
                initial={{ opacity: 0, y: MODAL_LAYER_SHIFT_PX }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: MODAL_LAYER_SHIFT_PX, transition: modalExitTransition }}
                transition={modalEnterTransition}
                className="flex flex-col gap-4"
              >
                {/* Status row: the icon, the per-status sentence and the explorer
                    link are all gone (Figma review). Flows that render a Steps
                    header already show the status chip there; flows without a step
                    list have no Steps header, so the chip renders inline here, in
                    the slot the old icon/message/loading-button treatment used to
                    occupy (Figma 2376:225580). The link left with them — a
                    confirmed transaction hands its hash to the success toast, and
                    a mid-flow link to one leg of a multi-step flow was noise. The
                    gate's own copy narrates an off-chain phase (screening,
                    terms signature) that the chip's txStatus-keyed label
                    cannot describe (APP-501). With a step list, the signature
                    step's own description already carries the terms copy, so
                    that sentence goes (Figma review 2829:141028/9: nothing
                    beyond a step's description on this screen) — but the
                    screening sentence has no step to live in, so it stays,
                    on its own: the list's header already shows the chip. */}
                {(() => {
                  const bottomChip = !showStepList && badgeContent;
                  const gateMessage = gateCopy?.message && !gateCopyInStepList ? gateCopy.message : undefined;
                  if (!bottomChip && !gateMessage) return null;
                  return (
                    <div className="flex items-center gap-3 pt-4">
                      {bottomChip && (
                        <StepsBadge variant={badgeVariant} dataTestId="transaction-status-badge">
                          {badgeContent}
                        </StepsBadge>
                      )}
                      {gateMessage && <Text className="text-textSecondary">{gateMessage}</Text>}
                    </div>
                  );
                })()}

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
                  <>
                    {chainGuardBlock}
                    <div className="flex w-full gap-3">
                      {/* No Back either once a step has mined (APP-448) or when
                          there is no first screen to go back to. */}
                      {!backLocked && !skipReview && (
                        <Button variant="secondary" size="xl" className="flex-1" onClick={handleBack}>
                          <Trans>Back</Trans>
                        </Button>
                      )}
                      {chainGuarded && guardCta ? (
                        guardCta
                      ) : (
                        <Button
                          variant="primary"
                          size="xl"
                          className="flex-1"
                          onClick={handleRetry}
                          disabled={chainGuarded}
                        >
                          {errorLabel ?? <Trans>Retry</Trans>}
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
