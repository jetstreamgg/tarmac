import type { ReactNode } from 'react';
import type { TransactionSubtitles } from '@/modules/ui/components/TransactionModal';
import type { TxStatus } from '@/widgets';

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
  title: string;
  subtitles?: TransactionSubtitles;
  transactionContent?: ReactNode;
  /** Optional node rendered to the right of the title — e.g. a slippage gear. */
  rightHeaderComponent?: ReactNode;
  onConfirm: () => void;
  onRetry?: () => void;
  confirmLabel?: string;
  /** Disables the Confirm button — e.g. while a quote is refetching. */
  confirmDisabled?: boolean;
  successLabel?: string;
  errorLabel?: string;
  onSuccess?: () => void;
  onError?: () => void;
  /** Step labels for multi-step transactions (e.g. ["Approve", "Supply"]). */
  steps?: string[];
  /** Analytics metadata for tracking transaction lifecycle events. */
  analytics?: TransactionAnalytics;
  /** Identity used to gate updateModalContent calls to the active session. */
  sessionId?: string;
};

/** The subset of config a flow may live-update after launch (gated on sessionId). */
export type LiveModalUpdate = Partial<
  Pick<TransactionConfig, 'transactionContent' | 'rightHeaderComponent' | 'confirmDisabled'>
>;

/**
 * Lifecycle callbacks spread into write hooks. Compatible with both
 * WriteHookParams and BatchWriteHookParams. `hash` is the on-chain tx hash where
 * one exists; for EIP-5792 batches it is undefined until a receipt resolves (see
 * the EIP-5792 rule above).
 */
export type TxCallbacks = {
  onMutate: () => void;
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
