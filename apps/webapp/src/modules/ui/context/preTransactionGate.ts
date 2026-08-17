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
 * The provider surface an async gate drives while it holds the floor. All
 * three are bound to the live session: after a close or relaunch they act on
 * the new session's state, which is why a gate must never keep using them
 * after its verdict resolved (the generation guard drops the verdict anyway).
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
   */
  setGateStatus: (status: 'initialized' | 'error' | 'idle') => void;
  /**
   * Mounts off-chain prelude steps ahead of the config's own step list (or
   * clears them with null). Cleared automatically on launch and close.
   */
  setPreludeSteps: (steps: TransactionStep[] | null) => void;
  /** Tears the transaction modal down — the gate is replacing it with its own surface. */
  closeModal: () => void;
};

export type GateVerdict = {
  /** True lets the guarded action (the config callback) run. */
  allow: boolean;
};

export type PreTransactionGate = (context: {
  trigger: GateTrigger;
  controls: GateControls;
}) => GateVerdict | Promise<GateVerdict>;

/** Pass-through gate: every transaction allowed, synchronously. Tests and Storybook-style mounts. */
export const allowAllGate: PreTransactionGate = () => ({ allow: true });
