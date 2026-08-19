/**
 * The pre-transaction gate (APP-496): consulted by the TransactionProvider
 * between the user's confirm and the config's `onConfirm` — one choke point
 * covering every launch site, including retries and two-action entries, so a
 * flow cannot start a write without passing it.
 *
 * This ships as a pass-through: `allowAllGate` answers synchronously, which
 * keeps `onConfirm` (and the engine's `onMutate`) firing in the same tick as
 * the click — behaviour identical to before the gate existed. The real
 * verdict (the per-transaction Terms of Use signature for US users, APP-501)
 * replaces the stub without touching the plumbing.
 *
 * Contract for async gates (the C6 signature flow):
 *  - Resolve with a verdict; never reject. A rejection is treated as a denial
 *    (the action must not run on an error), but the gate owns surfacing what
 *    went wrong — the provider stays silent about it.
 *  - A denial is terminal for that click. The gate is responsible for any
 *    state the user needs to recover (e.g. driving the signature step to its
 *    failed rendering); the provider simply doesn't run the action.
 */

/** What caused the gate to run — the same gate guards all three entry points. */
export type GateTrigger = 'confirm' | 'secondaryConfirm' | 'retry';

export type GateVerdict = {
  /** True lets the guarded action (the config callback) run. */
  allow: boolean;
};

export type PreTransactionGate = (context: { trigger: GateTrigger }) => GateVerdict | Promise<GateVerdict>;

/** The C5 stub: every transaction passes, synchronously. */
export const allowAllGate: PreTransactionGate = () => ({ allow: true });
