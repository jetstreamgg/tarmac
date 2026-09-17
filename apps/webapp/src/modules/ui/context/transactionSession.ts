import type { ReactNode } from 'react';

/**
 * One launch of the transaction modal. Created by `launch()`, marked `closed`
 * by the close that ends it, and never reused: everything the provider used
 * to key on a generation counter keys on the object instead. An engine
 * callback that closes over a session can only ever reach that session, and
 * a closed session ignores it.
 */
export type TransactionSession = {
  /** The config's `sessionId`, for gating live updates to the flow that launched. */
  id: string | null;
  /** Mount key: each launch gets a FRESH host and modal (screen back to first, inputs cleared). */
  key: number;
  /** What the provider needs before the flow mounts. */
  launch: {
    supportedChainIds: number[];
    chainGuardReason?: 'product-unavailable' | 'launch-chain';
    skipReview: boolean;
  };
  /** The flow component (a config launch renders the `ConfigFlow` adapter). */
  render: () => ReactNode;
  /** Set by the close (or the launch that replaces this session); read by every callback. */
  closed: boolean;
  /**
   * The chain the session's write belongs to: latched at launch, adopted while
   * still IDLE (see the chain-change close in the provider).
   */
  chainId: number;
  /** Where the session was launched (window.location); a route change elsewhere closes it. */
  launchPathname: string;
  /** Analytics flow id latched at launch so the session's events stay joined. */
  flowId: string | undefined;
  /**
   * Hash of the write this session is tracking, latched at `onStart`, so a
   * settle carrying a DIFFERENT hash is recognisable as another transaction's.
   */
  writeHash: string | undefined;
  /** Latest on-chain hash, for the toasts. */
  hash: string | undefined;
};

export function createTransactionSession(init: {
  id: string | null;
  key: number;
  launch: TransactionSession['launch'];
  render: () => ReactNode;
  chainId: number;
  launchPathname: string;
  flowId: string | undefined;
}): TransactionSession {
  return { ...init, closed: false, writeHash: undefined, hash: undefined };
}
