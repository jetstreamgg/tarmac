import type { ReactNode } from 'react';
import type { Call } from 'viem';
import type { TransactionStep } from '@/modules/ui/components/transactionStepsModel';
import type { TxMutateVariables } from '@/hooks';
import type { CallMatcher } from '@/modules/ui/lib/callIntent';

/**
 * A flow is launched with `launch({ flow: <XFlow … /> })`. The provider mounts that
 * element for the session's lifetime (minimize included); it runs its own engine
 * with `useSession().txCallbacks` and renders `<TransactionModal>` from its own
 * state on every render.
 *
 * Lifecycle (`TxStatus`): IDLE → INITIALIZED (awaiting wallet) → LOADING
 * (submitted) → SUCCESS | ERROR. Multi-step flows advance the step each time
 * `onMutate` fires while already INITIALIZED/LOADING.
 *
 * EIP-5792 (batched): success requires `data.status === 'success'`; while pending
 * the tracked id is the bundle id, so `onStart` gets `undefined`.
 */

/** Analytics metadata passed by flows to attribute events correctly. */
export type TransactionAnalytics = {
  /** Widget/page name (e.g. "vaults"). */
  widgetName: string;
  /** Transaction flow (e.g. "claim"). */
  flow: string;
  /** Specific action within the flow (e.g. "claim"). */
  action?: string;
  /** Extra data merged into every analytics event (e.g. module, claimedRewards). */
  data?: Record<string, unknown>;
};

/**
 * An editable first screen. The modal opens on it instead of the read-only
 * review; with `transactionContent` also set the flow runs entry → review →
 * transaction.
 */
export type TransactionEntry = {
  content: ReactNode;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  /** Explanatory only: pair it with `confirmDisabled` to block the confirm. */
  errorMessage?: string;
  /** A second CTA beside the primary one, entry-only flows only (Figma 1036:214001). */
  secondaryConfirmLabel?: string;
  secondaryConfirmDisabled?: boolean;
  /**
   * While set, the primary CTA fires this INSTEAD of starting the transaction
   * (e.g. a disconnected upgrade modal's "Connect wallet").
   */
  confirmAction?: () => void;
};

/**
 * What a deferred dispatch (an async gate verdict, Retry) is re-checked against.
 * The view freezes once the transaction leaves IDLE while the engine keeps
 * rebuilding calldata from live quotes, so without this a deferred dispatch could
 * sign terms the user never saw.
 */
export type DispatchChecks = {
  /**
   * The calls `onConfirm` would send now. Snapshotted at the confirm; a deferred
   * dispatch must still be a tail of that snapshot (calls legitimately drop off
   * the front: a landed approve, a resumed sequence).
   */
  nextCalls?: readonly Call[];
  /** Relaxes the comparison per call (see `tightensOnly`); omitted, byte equality. */
  callMatches?: CallMatcher;
  /**
   * The flow's live confirm gating. Refuses a deferred dispatch the flow would no
   * longer allow, except a retry after a mined step (the run itself moved the
   * balances the form checks).
   */
  disabled?: boolean;
  /** Refuses a deferred dispatch on every trigger, a retry after a mined step included. */
  blocked?: boolean;
};

/** Props a flow renders `<TransactionModal>` with. */
export type TransactionFlowProps = {
  title: string;
  /** Wallet/status screen title; defaults to `title`. */
  transactionTitle?: string;
  /** A three-screen flow's review title; defaults to `title`. */
  reviewTitle?: string;
  /** A first-screen disclosure under the title (Pendle's early-withdrawal note). */
  subtitle?: string;
  titleBadge?: ReactNode;
  rightHeaderComponent?: ReactNode;
  entry?: TransactionEntry;
  /** The read-only review body (or a three-screen flow's middle stage). */
  transactionContent?: ReactNode;
  /** Compact wallet/status body; falls back to `transactionContent` on review-first flows. */
  transactionScreenContent?: ReactNode;
  /**
   * The flow's own surface already was the review (the stake takeovers): the
   * modal opens on the wallet/status screen and confirms once on mount, through
   * the same gate. Mutually exclusive with `entry`.
   */
  skipReview?: boolean;
  /** The modal replaces another that unmounts in the same commit: its scrim mounts already up. */
  scrimHandoff?: boolean;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  /** The review screen's prepare failure (the entry reads `entry.errorMessage`). */
  errorMessage?: string;
  successLabel?: string;
  errorLabel?: string;
  steps?: TransactionStep[];
  /** Minimized/success toast titles per state; a missing one falls back to `title`. */
  toast?: { loading?: string; success?: string; error?: string };
  analytics?: TransactionAnalytics;
  /**
   * Estimated USD notional (APP-517), compared against the enhanced-screening
   * threshold. `undefined` means unknown and is treated as above it. Required so
   * every flow states its valuation at compile time.
   */
  usdValue: number | undefined;
  onConfirm: () => void;
  /** Fires the entry's secondary CTA (see `TransactionEntry.secondaryConfirmLabel`). */
  onSecondaryConfirm?: () => void;
  /** The secondary action's own steps and analytics, used once it is the one clicked. */
  secondarySteps?: TransactionStep[];
  secondaryAnalytics?: TransactionAnalytics;
  /** Defaults to `onConfirm`. */
  onRetry?: () => void;
  onSuccess?: () => void;
  onError?: () => void;
  dispatch?: DispatchChecks;
};

export type LaunchOptions = {
  /** The flow element, mounted for the session's lifetime. */
  flow: ReactNode;
  /** Identity for `activeSessionId` (the page-side minimized lock). */
  sessionId?: string;
  /**
   * The chains this flow's calldata may be built for and sent on (APP-528). Off
   * them every firing CTA is held and a switch prompt replaces it, so a product
   * address resolved on one chain is never sent as calldata on another. Required
   * so no launch site can omit it; an empty array disables the guard.
   */
  supportedChainIds: number[];
  /**
   * Picks the guard's copy: `launch-chain` when the set is just the launch chain
   * because the flow's figures were resolved there (Convert, APP-563 #4).
   */
  chainGuardReason?: 'product-unavailable' | 'launch-chain';
};

/**
 * Lifecycle callbacks a flow spreads into its engine. `hash` is the on-chain tx
 * hash where one exists; `blockNumber` on success is the last receipt's block,
 * which the history refresh waits for the indexer to reach.
 */
export type TxCallbacks = {
  /** `variables.functionName` (sequential legs only) discriminates approve legs in analytics. */
  onMutate: (variables?: TxMutateVariables) => void;
  onStart: (hash?: string) => void;
  onSuccess: (hash?: string, blockNumber?: bigint) => void;
  onError: (error: Error, hash?: string) => void;
};

export type TransactionContextValue = {
  /** Opens a session for the flow, unless a transaction is already on-chain. */
  launch: (options: LaunchOptions) => void;
  /** True while a session is live, minimized or not. */
  isModalOpen: boolean;
  /** Hide the modal without ending the transaction. */
  minimize: () => void;
  restore: () => void;
  isMinimized: boolean;
  /** `sessionId` of the live session, null when there is none. */
  activeSessionId: string | null;
  /** An ended session of this `sessionId` still has a write out: its review Confirm stays held, and its launcher should hold too. */
  isSettling: (sessionId: string) => boolean;
  /**
   * Called by the app shell on every pathname change: closes the session unless
   * a write is in flight, it is minimized, or it was launched on that route.
   */
  closeOnNavigation: (pathname: string) => void;
};
