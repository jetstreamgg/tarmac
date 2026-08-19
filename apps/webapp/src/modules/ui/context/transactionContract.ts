import type { ReactNode } from 'react';
import type { TransactionStep, TransactionSubtitles } from '@/modules/ui/components/TransactionModal';
import type { TxStatus } from '@/widgets';
import type { TxMutateVariables } from '@/hooks';

/**
 * The frozen transaction-orchestration contract: a flow calls `launch(config)`,
 * spreads `txCallbacks` into its write hook, and the modal renders the lifecycle.
 * Freezing it lets the redesign build against a stable interface while the
 * orchestration is rewritten.
 *
 * Lifecycle (`TxStatus`): IDLE → INITIALIZED (awaiting wallet) → LOADING
 * (submitted) → SUCCESS | ERROR | CANCELLED. Multi-step flows advance
 * `currentStep` each time `onMutate` fires while already INITIALIZED/LOADING.
 *
 * Safe-aware hash: the explorer link is resolved by the context via
 * `getTransactionLink(chainId, address, hash, isSafeWallet)` — Safe wallets link
 * to the Safe queue, everyone else to Etherscan. Consumers only pass the hash.
 *
 * EIP-5792 (batched): success requires `data.status === 'success'` (not
 * `isSuccess` alone); the hash is `data.receipts[0].transactionHash`. While
 * pending the tracked id is the bundle id, so `onStart` gets `undefined`.
 */

/**
 * An editable "entry" first screen (PRD module 1). When a config carries one, the
 * shared modal opens on this screen instead of the read-only review, gated by
 * `confirmDisabled` and labelled by `confirmLabel`. Confirming advances to the same
 * wallet/status screen and fires the config's `onConfirm`.
 *
 * The interactive body is supplied one of two ways:
 *  - `content` — rendered inside the dialog. Simple for review-style entries, but
 *    it unmounts when the dialog is hidden (so it can't host a minimize-surviving
 *    hook). A body here keeps its `confirmDisabled` / `onConfirm` live via
 *    `updateModalContent` (the merge preserves `content`, so it never remounts).
 *  - omit `content` and supply `backgroundContent` on the config instead — the body
 *    lives in a hidden, always-mounted host (so its in-flight hook survives a
 *    minimize) and portals its inputs into the dialog's entry slot.
 */
export type TransactionEntry = {
  content?: ReactNode;
  confirmLabel?: string;
  /** Disables the entry's confirm button (e.g. amount is zero / over balance). */
  confirmDisabled?: boolean;
  /**
   * User-readable engine/prepare failure rendered above the entry's confirm
   * button (e.g. a failed withdraw simulation). Explanatory only — pair it with
   * `confirmDisabled` to actually block the confirm. Push `undefined` to clear
   * it when the engine recovers.
   */
  errorMessage?: string;
  /**
   * Label for an optional second CTA drawn beside the primary one (Figma
   * 1036:214001: the stake claim entry pairs a secondary "Claim" with the
   * primary "Claim & Restake SKY"). Only honoured on entry-only flows — a
   * three-screen flow's entry advances to its review, which has a single
   * confirm. Clicking advances to the wallet screen and fires the config's
   * `onSecondaryConfirm`.
   */
  secondaryConfirmLabel?: string;
  /** Disables the secondary CTA independently of the primary one. */
  secondaryConfirmDisabled?: boolean;
  /**
   * While set, the entry's primary CTA fires this INSTEAD of starting the
   * transaction — the modal stays on the entry screen and the config's
   * `onConfirm` doesn't run. Lets a flow surface a prerequisite in the primary
   * slot (e.g. a disconnected upgrade modal's "Connect wallet") while the form
   * beneath stays visible; push `undefined` to restore the normal confirm.
   */
  confirmAction?: () => void;
};

/** Analytics metadata passed by consumers to attribute events correctly. */
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

/** The config a consumer passes to `launch()` for a standard on-chain transaction. */
export type TransactionConfig = {
  /** Title for the first (review/entry) screen — and the whole modal when no `transactionTitle`. */
  title: string;
  /** Title for the wallet/status screen (e.g. "Confirm in the wallet"); defaults to `title`. */
  transactionTitle?: string;
  /**
   * Title for the review stage of a three-screen flow (e.g. "Review supply");
   * defaults to `title`. A config carrying both `entry` and `transactionContent`
   * runs entry → review → transaction; entry-only and review-only configs keep
   * their two screens.
   */
  reviewTitle?: string;
  subtitles?: TransactionSubtitles;
  transactionContent?: ReactNode;
  /**
   * Compact body for the wallet/status screen ("Confirm in the wallet"). Figma
   * shows a relabelled amount summary there instead of the full review breakdown.
   * Falls back to `transactionContent` when omitted, so existing consumers render
   * unchanged.
   */
  transactionScreenContent?: ReactNode;
  /**
   * Editable first screen. When present the modal opens on the entry screen
   * (instead of the read-only review built from `transactionContent`). Both lead
   * to the same wallet/status screen.
   */
  entry?: TransactionEntry;
  /**
   * Content the provider keeps mounted (hidden) for the whole modal lifetime —
   * independent of which screen is showing and of minimize. This is where a flow
   * hosts the in-flight engine hook whose receipt-watcher must survive a minimize:
   * unlike `entry.content` (inside the Radix dialog, which unmounts when hidden),
   * `backgroundContent` lives outside the dialog so the running transaction is
   * never torn down. The visible inputs live in `entry.content` and share state
   * with this host (e.g. via a session-keyed store).
   */
  backgroundContent?: ReactNode;
  /** Optional node rendered to the right of the title — e.g. a slippage gear. */
  rightHeaderComponent?: ReactNode;
  /** Optional badge rendered immediately after the title — e.g. a "Merkl" source chip. */
  titleBadge?: ReactNode;
  /**
   * Per-state titles for the toast shown while the modal is minimized (it's hidden,
   * so the toast notifies progress). Flows set amount-aware titles here (e.g.
   * "10,000.00 USDS supplied!"); each falls back to the matching `subtitles` entry,
   * then `title`. An editable flow pushes these live via `updateModalContent` as the
   * amount changes.
   */
  toast?: {
    loading?: string;
    success?: string;
    error?: string;
  };
  onConfirm: () => void;
  /**
   * Fires when the entry's secondary CTA is clicked (see
   * `TransactionEntry.secondaryConfirmLabel`). A two-action flow routes each
   * CTA to its own engine and pushes the clicked mode's `steps`/`analytics`
   * via `updateModalContent` before executing.
   */
  onSecondaryConfirm?: () => void;
  onRetry?: () => void;
  confirmLabel?: string;
  /** Disables the Confirm button — e.g. while a quote is refetching. */
  confirmDisabled?: boolean;
  /**
   * User-readable engine/prepare failure rendered above the review screen's
   * confirm button (the entry screen reads `entry.errorMessage` instead — the
   * same dual sourcing as `confirmDisabled`).
   */
  errorMessage?: string;
  successLabel?: string;
  errorLabel?: string;
  onSuccess?: () => void;
  onError?: () => void;
  /**
   * Steps for multi-step transactions — a bare label or `{ label, tokenSymbol }`
   * to render the DS token chip (e.g. `{ label: "Approve", tokenSymbol: "USDS" }`).
   */
  steps?: TransactionStep[];
  /** Analytics metadata for tracking transaction lifecycle events. */
  analytics?: TransactionAnalytics;
  /** Identity used to gate updateModalContent calls to the active session. */
  sessionId?: string;
};

/**
 * The subset of config a flow may live-update after launch (gated on sessionId).
 * An in-modal entry body uses this to keep its gating + confirm fresh: `entry` is
 * a *partial* merged into the existing entry (so `content` need not be re-pushed,
 * and the body stays mounted), and `onConfirm` / `steps` are swapped to reflect
 * the current amount. A two-action flow additionally pushes the clicked mode's
 * `steps`/`analytics` (and an `onRetry` routed to the last-clicked engine) at
 * confirm time — the provider applies updates to its config ref synchronously,
 * so the engine's `onMutate` (fired in the same click) sees them.
 */
export type LiveModalUpdate = Partial<
  Pick<
    TransactionConfig,
    | 'transactionContent'
    | 'transactionScreenContent'
    | 'rightHeaderComponent'
    | 'confirmDisabled'
    | 'errorMessage'
    | 'onConfirm'
    | 'onSecondaryConfirm'
    | 'onRetry'
    | 'steps'
    | 'toast'
    | 'analytics'
  >
> & {
  /** Partial entry merged into the existing entry — `content` is preserved if omitted. */
  entry?: Partial<TransactionEntry>;
};

/**
 * Lifecycle callbacks spread into write hooks. Compatible with both
 * WriteHookParams and BatchWriteHookParams. `hash` is the on-chain tx hash where
 * one exists; for EIP-5792 batches it is undefined until a receipt resolves (see
 * the EIP-5792 rule above).
 */
export type TxCallbacks = {
  /** `variables.functionName` (sequential legs only) discriminates approve legs in analytics. */
  onMutate: (variables?: TxMutateVariables) => void;
  onStart: (hash?: string) => void;
  onSuccess: (hash?: string) => void;
  onError: (error: Error, hash?: string) => void;
};

/** The value exposed by the transaction context. */
export type TransactionContextValue = {
  /** Open the transaction modal with a review screen. */
  launch: (config: TransactionConfig) => void;
  /** Live-update body / right-header / confirm-disabled. Gated on sessionId. */
  updateModalContent: (sessionId: string, partial: LiveModalUpdate) => void;
  isModalOpen: boolean;
  /** Hide the modal without ending the transaction — it keeps running in the background. */
  minimize: () => void;
  /** Re-show a minimized modal at its current lifecycle state. */
  restore: () => void;
  /** Whether the modal is currently minimized (hidden but still tracking a tx). */
  isMinimized: boolean;
  /** Transaction lifecycle callbacks to spread into write hooks. */
  txCallbacks: TxCallbacks;
  /** Current transaction status. */
  txStatus: TxStatus;
};

/* ============================================================================
 * Async-order variant (CoW / ETH-flow) — TYPE SPIKE. Not wired to production
 * (proven by the throwaway harness). Models the off-chain lifecycle with no
 * receipt: sign (EIP-712) → POST → orderId (UID) → poll → terminal.
 *
 * What it formalizes vs the on-chain flow:
 *  - No tx hash. The order is its UID; the link uses `orderExplorerUrl(orderId)`.
 *  - Retry RE-POLLS the existing order — never re-signs (that would create a
 *    second order).
 *  - All terminal states surface (today's Trade flow drops cancelled/expired).
 *
 * Status → TxStatus: presignaturePending|open → LOADING; fulfilled → SUCCESS;
 * cancelled → CANCELLED; expired → ERROR (retry re-polls).
 * ========================================================================== */

/** CoW order status (mirrors `OrderStatus` in cowApiSchema). */
export type AsyncOrderStatus = 'presignaturePending' | 'open' | 'fulfilled' | 'cancelled' | 'expired';

/** The config a consumer passes to `launch()` for an off-chain (async) order. */
export type AsyncOrderConfig = Pick<
  TransactionConfig,
  | 'title'
  | 'subtitles'
  | 'transactionContent'
  | 'rightHeaderComponent'
  | 'confirmLabel'
  | 'confirmDisabled'
  | 'successLabel'
  | 'errorLabel'
  | 'steps'
  | 'analytics'
  | 'sessionId'
  | 'onSuccess'
  | 'onError'
> & {
  /** Discriminant separating this from the on-chain `TransactionConfig`. */
  kind: 'async-order';
  /** Sign + POST the order; resolves with the order UID. No tx hash / receipt. */
  submitOrder: () => Promise<string>;
  /** Poll an order's status by UID. Idempotent — retry re-polls, never re-signs. */
  pollOrderStatus: (orderId: string) => Promise<AsyncOrderStatus>;
  /** Cancel an open order by UID. */
  cancelOrder?: (orderId: string) => Promise<void>;
  /** Explorer URL for the order, shown in place of the tx-hash link. */
  orderExplorerUrl?: (orderId: string) => string;
  /** Poll cadence in ms; defaults to 2000 (matches the current Trade flow). */
  pollIntervalMs?: number;
};

/** What a future `launch()` accepts: the frozen on-chain config or the async-order variant. */
export type LaunchConfig = TransactionConfig | AsyncOrderConfig;

/** Narrows a LaunchConfig to the async-order variant. */
export function isAsyncOrderConfig(config: LaunchConfig): config is AsyncOrderConfig {
  return (config as AsyncOrderConfig).kind === 'async-order';
}
