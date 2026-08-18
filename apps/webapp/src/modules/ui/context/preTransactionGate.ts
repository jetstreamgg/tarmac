import type { ReactNode } from 'react';
import type { TransactionStep } from '@/modules/ui/components/transactionStepsModel';

/**
 * The pre-transaction gate (APP-496): consulted by the TransactionProvider
 * between the user's confirm and the config's `onConfirm` — one choke point
 * covering every launch site, including retries and two-action entries, so a
 * flow cannot start a write without passing it.
 *
 * The verdict itself (APP-501) re-screens the address, and for US/VPN users
 * without a signature for the current terms version inserts the off-chain
 * signature step. The provider stays policy-free: it hands the gate a small
 * set of controls and runs the action only on an allow.
 *
 * Contract for async gates (the C6 signature flow):
 *  - Resolve with a verdict; never reject. A rejection is treated as a denial
 *    (the action must not run on an error), but the gate owns surfacing what
 *    went wrong — the provider stays silent about it.
 *  - A denial is terminal for that click. The gate is responsible for any
 *    state the user needs to recover (e.g. driving the signature step to its
 *    failed rendering); the provider simply doesn't run the action.
 *  - Drive the modal's status the moment the verdict goes async: the modal
 *    advances to its transaction screen on the click itself, and at IDLE that
 *    screen has no icon, message, or buttons to show.
 */

/** What caused the gate to run — the same gate guards all three entry points. */
export type GateTrigger = 'confirm' | 'secondaryConfirm' | 'retry';

/**
 * Gate-owned copy shown in place of the flow's own while a gate status is
 * driving the modal — the flow's copy narrates on-chain writes ("Confirm this
 * transaction in your wallet", the flow's error sentence), which is wrong
 * while the gate is only screening an address or awaiting an off-chain
 * signature. Replaced on every `setGateStatus` call (omitting it restores the
 * flow's copy) and cleared on launch/close.
 */
export type GateStatusCopy = {
  /** Replaces the status row's message (e.g. "Confirm this transaction in your wallet."). */
  message?: ReactNode;
  /** Replaces the status-keyed subtitle under the modal title. */
  subtitle?: string;
};

/**
 * The provider surface an async gate drives while it holds the floor. Each
 * call to the gate receives controls bound to the session generation of that
 * click: after a close or relaunch every control becomes a no-op, so a stale
 * continuation (a wallet prompt answered after the modal closed, a re-screen
 * resolving late) cannot touch the new session by construction. `isStale`
 * lets the gate also stop early — most importantly before prompting the
 * wallet at all.
 */
export type GateControls = {
  /**
   * Drives the modal's status while the verdict is pending ('initialized'),
   * on a denial the user recovers from in place ('error' — with a signature
   * prelude step mounted this renders the failed-signature row + retry), or
   * back to 'idle' immediately before allowing an action that will drive the
   * status itself. That last one matters: the engine's `onMutate` advances
   * `currentStep` when it fires at INITIALIZED — correct exactly when a
   * prelude step was inserted and now needs stepping past, wrong otherwise.
   * The optional copy replaces the flow's status copy while set.
   */
  setGateStatus: (status: 'initialized' | 'error' | 'idle', copy?: GateStatusCopy) => void;
  /**
   * Mounts off-chain prelude steps ahead of the config's own step list (or
   * clears them with null). Cleared automatically on launch and close.
   */
  setPreludeSteps: (steps: TransactionStep[] | null) => void;
  /** Tears the transaction modal down — the gate is replacing it with its own surface. */
  closeModal: () => void;
  /**
   * True once the session this gate run belongs to has closed or been
   * replaced. Check it after every await — and always before starting a
   * wallet interaction, which is the one side effect the no-op controls
   * cannot absorb.
   */
  isStale: () => boolean;
};

export type GateVerdict = {
  /** True lets the guarded action (the config callback) run. */
  allow: boolean;
};

export type PreTransactionGate = (context: {
  trigger: GateTrigger;
  /**
   * The transaction's estimated USD notional, read from the active config at
   * fire time (APP-517). Decides the screening tier: at or above the
   * enhanced-screening threshold — and when UNKNOWN (`undefined`) — the gate
   * screens via the enhanced endpoint instead of the standard one.
   */
  usdValue: number | undefined;
  controls: GateControls;
}) => GateVerdict | Promise<GateVerdict>;

/** Pass-through gate: every transaction allowed, synchronously. Tests and Storybook-style mounts. */
export const allowAllGate: PreTransactionGate = () => ({ allow: true });

/**
 * The modal-side half of the enhanced-screening surface (APP-517): a hook the
 * provider calls every render with the active session's live USD value. At or
 * above the threshold it warms the enhanced verdict so the gate can pass
 * synchronously at Confirm, and its result drives the first-screen CTAs — a
 * transaction cannot be fired while the check is pending, failed, or risky.
 * The message renders inside the modal, above the CTA.
 *
 * Injectable (like `gate`) so the provider stays policy-free and tests can
 * exercise each state; the app mounts `useEnhancedScreeningPreflight`.
 */
export type TransactionPreflight =
  /** No check owed (below threshold / no session / checks skipped), or it passed. */
  | { kind: 'clear' }
  /** The check is required and its verdict is still in flight. */
  | { kind: 'pending' }
  /** The check failed (risky, or unavailable — fail closed). The message is shown above the CTA. */
  | { kind: 'blocked'; message: ReactNode };

export type PreflightHook = (context: {
  /** Live USD value of the active config (see `TransactionConfig.usdValue`); undefined = unknown. */
  usdValue: number | undefined;
  /** True while a transaction session is active (modal open or minimized). */
  active: boolean;
}) => TransactionPreflight;

/** Pass-through preflight: never gates. Tests and Storybook-style mounts. */
export const allowAllPreflight: PreflightHook = () => ({ kind: 'clear' });
