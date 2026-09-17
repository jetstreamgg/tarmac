import { createContext, useContext } from 'react';
import type { TxStatus } from '@/modules/ui/lib/txStatus';
import type { TransactionStep } from '@/modules/ui/components/transactionStepsModel';
import type { ChainGuard } from '@/modules/ui/components/TransactionModal';
import type { GateStatusCopy, PreflightHook } from './preTransactionGate';
import type { LiveFlowProps, TransactionAnalytics } from './transactionContract';

/** The session's lifecycle state, as the modal renders it. */
export type ShellView = {
  txStatus: TxStatus;
  currentStep: number;
  /** A step of this session has mined: a failure must resume, never reopen the inputs. */
  hasMinedStep: boolean;
  /** The ERROR on screen is a wallet Reject — worded as declined, not rolled back. */
  userRejected: boolean;
  /** Gate-mounted off-chain steps rendered ahead of the flow's own list (APP-501). */
  preludeSteps: TransactionStep[] | null;
  /** Gate-owned status copy override (APP-501). */
  gateCopy: GateStatusCopy | null;
};

/** Live props a two-CTA flow states at the click, ahead of the write it fires in the same tick. */
export type FireOverrides = { analytics?: TransactionAnalytics; usdValue?: number | undefined };

/**
 * What the provider hands the modal a flow renders: the session's state, the
 * gated actions, and the registration through which the provider reads the
 * flow's callbacks and copy after launch. One per mounted session host.
 */
export type TransactionShell = {
  /** The dialog is visible: session open, not minimized, not exiting. */
  open: boolean;
  /** The session is alive (open or minimized). False for the host held through its exit animation. */
  active: boolean;
  view: ShellView;
  chainGuard: ChainGuard | null;
  skipReview: boolean;
  /** The enhanced-screening preflight hook (APP-517); the modal calls it with its own gating. */
  usePreflight: PreflightHook;
  /** The modal registers what the provider reads off the flow, every render. */
  register: (live: LiveFlowProps) => void;
  /** The first-screen confirm: gated, then `action` (the flow's execute). */
  confirm: (action: () => void, overrides?: FireOverrides) => void;
  /** The entry's secondary CTA: gated, then `action`. */
  secondaryConfirm: (action: () => void, overrides?: FireOverrides) => void;
  /** The failure view's retry: gated, progress reset, then `action`. */
  retry: (action: () => void) => void;
  /** A three-screen flow's entry advanced to its review (analytics). */
  reviewStage: () => void;
  /** Back to an editable first screen: the status returns to IDLE. */
  back: () => void;
  close: () => void;
  minimize: () => void;
  /** The gate drives the modal's back-to-first-screen on an enhanced-screening denial. */
  registerReturnToFirstScreen: (fn: (() => void) | null) => void;
  /** Config-launch adapter only: the entry-screen portal target for `backgroundContent` inputs. */
  registerEntrySlot: (el: HTMLElement | null) => void;
};

export const TransactionShellContext = createContext<TransactionShell | null>(null);

export function useTransactionShell(): TransactionShell {
  const shell = useContext(TransactionShellContext);
  if (!shell) throw new Error('TransactionModal must be rendered by a launched flow');
  return shell;
}
