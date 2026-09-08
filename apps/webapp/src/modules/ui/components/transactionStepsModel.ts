import type { ReactNode } from 'react';
import { t } from '@lingui/core/macro';
import { TxStatus } from '@/widgets/shared/constants';
import type { StepState } from '@/components/ui/steps';

/**
 * One entry of a flow's step list. The plain-string form is a bare label; the
 * object form adds the token rendered as an icon+symbol chip after the label
 * (DS Steps pattern, Figma 5200:30561) — e.g. `{ label: "Approve", tokenSymbol:
 * "SKY" }` renders "Approve ◉ SKY". A step that swaps one token for another
 * (e.g. Convert) also sets `targetTokenSymbol`, rendering a second icon+symbol
 * chip after a translated "to" — "Convert ◉ USDS to ◉ USDC" (Figma step-2 row,
 * two token chips side by side, not stacked).
 */
export type TransactionStep =
  | string
  | {
      label: string;
      tokenSymbol?: string;
      /** Second token for a source→target step; ignored when `tokenSymbol` is unset. */
      targetTokenSymbol?: string;
      /**
       * Flow-specific sentence appended after the generic rollback copy when
       * this step fails — e.g. "The USDS hasn't been approved." (Figma
       * 1030:139111 failure states).
       */
      failureDetail?: string;
      /**
       * 'signature' marks an off-chain pre-flight step (the per-transaction
       * Terms of Use signature, Figma 1868:80848): no hash, no receipt, and it
       * always runs BEFORE the wallet sees a write. That holds in bundled
       * flows too — a signature cannot ride inside an EIP-5792 bundle (the
       * comps draw it bundled, but a wallet can't include an off-chain
       * signature in a batch), so the on-chain steps stay upcoming until the
       * signature completes and only then light up together. Omitted = a
       * normal on-chain write step.
       */
      kind?: 'signature';
      /**
       * Index of the on-chain WRITE this row belongs to, for a flow whose
       * sequential (non-bundled) path sends several legs in one transaction —
       * the stake engine folds lock, draw, selectFarm and selectVoteDelegate
       * into a single `multicall` after its approvals. `currentStep` counts
       * writes, so rows sharing a write light up, complete and fail together;
       * without it a row is its own write (one row per transaction, the
       * default every other flow relies on). Signature rows never set it.
       */
      write?: number;
      /**
       * Helper paragraph under the label while the step is ACTIVE — the comps
       * draw the review-and-accept copy (with its Terms/Privacy links, hence
       * ReactNode) under the in-progress signature step. Hidden on upcoming
       * and completed rows; a failed row builds its own failure copy instead.
       */
      description?: ReactNode;
    };

export type TransactionStepItem = {
  stepNumber: number;
  label: string;
  tokenSymbol?: string;
  targetTokenSymbol?: string;
  state: StepState;
  /** Grey helper paragraph under the label (active-step copy or failure copy). */
  description?: ReactNode;
  /** Where the "Try again" pill renders: on the failed row, or filling the next step slot (bundled). */
  retry?: 'trailing' | 'slot';
};

type DeriveInput = {
  steps: TransactionStep[];
  currentStep: number;
  txStatus: TxStatus;
  bundled: boolean;
  /**
   * The failure is the user pressing Reject in their wallet (EIP-1193 4001 and
   * friends — `isUserRejectedRequestError`). Nothing was broadcast, so the
   * failed row must not claim a rollback: the rollback copy exists for a
   * write the network refused, and reading it after a deliberate Reject tells
   * the user something happened on-chain that never did.
   */
  userRejected?: boolean;
};

/**
 * The step-specific consequence sentence appended after the generic rollback
 * copy when a step fails (Figma 2800:91683: "The network rolled back your
 * transaction. The USDS hasn't been approved."). Built per call — lingui's `t`
 * must run after locale activation.
 */
export const stepFailureDetail = {
  approve: (symbol: string) => t`The ${symbol} hasn't been approved.`,
  supply: (symbol: string) => t`The ${symbol} hasn't been supplied.`,
  withdraw: (symbol: string) => t`The ${symbol} hasn't been withdrawn.`,
  stake: (symbol: string) => t`The ${symbol} hasn't been staked.`,
  restake: (symbol: string) => t`The ${symbol} hasn't been restaked.`,
  borrow: (symbol: string) => t`The ${symbol} hasn't been borrowed.`,
  repay: (symbol: string) => t`The ${symbol} hasn't been repaid.`,
  claim: (symbol: string) => t`The ${symbol} hasn't been claimed.`,
  /** A claim spanning several tokens in one call — no single symbol to name. */
  claimRewards: () => t`The rewards haven't been claimed.`,
  convert: (symbol: string) => t`The ${symbol} hasn't been converted.`,
  upgrade: (symbol: string) => t`The ${symbol} hasn't been upgraded.`
};

const normalize = (step: TransactionStep) => (typeof step === 'string' ? { label: step } : step);
type NormalizedStep = ReturnType<typeof normalize>;

/**
 * Stamps `write` on a step list whose sequential path is "each of the first
 * `leadingWrites` rows is its own transaction, everything after rides in one"
 * — the stake engine's shape (approvals, then a single multicall). The rows'
 * own order is the engine's, so the leading count is all a caller needs.
 */
export function assignSequentialWrites(steps: TransactionStep[], leadingWrites: number): TransactionStep[] {
  return steps.map((step, i) => {
    const write = i < leadingWrites ? i : leadingWrites;
    return typeof step === 'string' ? { label: step, write } : { ...step, write };
  });
}

/**
 * The write each row belongs to. An explicit `write` is the FLOW's numbering,
 * which knows nothing of the gate's signature rows prepended ahead of it
 * (`preludeSteps`) — those advance `currentStep` like writes do — so it is
 * offset by the signature rows before it. Rows without one are their own
 * write, by index, which is the pre-existing one-row-per-transaction model.
 */
function writeIndices(steps: NormalizedStep[]): number[] {
  let signaturesBefore = 0;
  return steps.map((step, i) => {
    const write = step.kind === 'signature' || step.write === undefined ? i : step.write + signaturesBefore;
    if (step.kind === 'signature') signaturesBefore += 1;
    return write;
  });
}

/**
 * Maps a flow's step list + transaction progress to the per-row view state the
 * modal renders (DS Steps pattern). Standard flows advance one step per tx;
 * bundled flows mark every ON-CHAIN step active while the single bundle is in
 * flight, then complete together. Signature steps are the off-chain prelude in
 * both shapes: they advance one-by-one via `currentStep` (the gate drives the
 * same INITIALIZED → onMutate advancement a write does), and until the prelude
 * is done the bundle hasn't started — so its steps render upcoming, not active.
 */
export function deriveTransactionStepItems({
  steps,
  currentStep,
  txStatus,
  bundled,
  userRejected = false
}: DeriveInput): TransactionStepItem[] {
  const allDone = txStatus === TxStatus.SUCCESS;
  const failed = txStatus === TxStatus.ERROR;
  const normalized: NormalizedStep[] = steps.map(normalize);
  const writes = writeIndices(normalized);
  const rowsOfCurrentWrite = normalized.map((_, i) => writes[i] === currentStep);
  // One "Try again" per failed write, on its last row — a multi-leg write
  // that reverted would otherwise grow a pill per leg.
  const lastRowOfCurrentWrite = rowsOfCurrentWrite.lastIndexOf(true);

  // The flow is still in its off-chain prelude while `currentStep` sits on a
  // signature step — nothing has reached the wallet as a write yet.
  const inSignaturePhase =
    !allDone && normalized.find((_, i) => writes[i] === currentStep)?.kind === 'signature';

  // Bundled failure (Figma 1030:139111): the bundle fails as one unit, so the
  // list collapses to a failed summary slot plus a slot holding the retry pill —
  // the flow's own steps reappear once the retry restarts the bundle. Only once
  // the bundle actually started: a failure during the signature prelude renders
  // inline on the signature step below. Signatures already completed survive
  // the failure (they happened off-chain and aren't rolled back), so their rows
  // stay, completed, above the collapsed pair.
  if (failed && bundled && !inSignaturePhase) {
    const prelude: TransactionStepItem[] = normalized
      .slice(0, currentStep)
      .filter(step => step.kind === 'signature')
      .map((step, i) => ({
        stepNumber: i + 1,
        label: step.label,
        tokenSymbol: step.tokenSymbol,
        targetTokenSymbol: step.targetTokenSymbol,
        state: 'completed' as const
      }));
    return [
      ...prelude,
      {
        stepNumber: prelude.length + 1,
        label: userRejected ? t`Request declined` : t`Transaction failed`,
        tokenSymbol: undefined,
        state: 'failed',
        description: userRejected
          ? t`You declined the bundled transaction in your wallet. Try again and confirm it to continue.`
          : t`The network rolled back your transaction. Try again and confirm bundled transaction in your wallet.`
      },
      {
        stepNumber: prelude.length + 2,
        label: '',
        tokenSymbol: undefined,
        state: 'active',
        retry: 'slot'
      }
    ];
  }

  return normalized.map((step, i) => {
    const { label, tokenSymbol, targetTokenSymbol, failureDetail, kind, description } = step;
    const isSignature = kind === 'signature';

    // Failure on the write the flow stopped on (standard flows, or a bundled
    // flow still in its signature prelude — the bundled on-chain case returned
    // above): every row of that write retitles and carries the failure copy,
    // the last one the inline retry; earlier steps keep their completions,
    // later ones stay upcoming. A signature has no on-chain rollback, so it
    // gets its own sentence.
    if (failed && rowsOfCurrentWrite[i]) {
      const retry = i === lastRowOfCurrentWrite ? ('trailing' as const) : undefined;
      // A wallet Reject is the user backing out, not a network refusal: no
      // rollback sentence, no "hasn't been X" consequence (nothing was sent),
      // and the row says "declined" rather than "failed" — the same split the
      // chip makes ("Request declined" vs "Transaction failed").
      if (userRejected && !isSignature) {
        return {
          stepNumber: i + 1,
          label: t`${label} declined`,
          tokenSymbol: undefined,
          targetTokenSymbol: undefined,
          state: 'failed' as const,
          description: t`You declined the request in your wallet. Nothing was sent.`,
          retry
        };
      }
      const failure = isSignature
        ? t`The signature request was declined or could not be completed.`
        : t`The network rolled back your transaction.`;
      return {
        stepNumber: i + 1,
        label: t`${label} failed`,
        tokenSymbol: undefined,
        targetTokenSymbol: undefined,
        state: 'failed' as const,
        description: failureDetail ? `${failure} ${failureDetail}` : failure,
        retry
      };
    }

    const state: StepState =
      allDone ||
      // A signature step tracks currentStep in every flow shape; on-chain steps
      // do so only in standard flows (a bundle completes as one unit below).
      ((isSignature || !bundled) && writes[i] < currentStep)
        ? 'completed'
        : isSignature || !bundled
          ? writes[i] === currentStep
            ? 'active'
            : 'upcoming'
          : // On-chain step of a bundled flow: upcoming until the signature
            // prelude finishes, then the whole bundle is active together.
            inSignaturePhase
            ? 'upcoming'
            : 'active';

    return {
      stepNumber: i + 1,
      label,
      tokenSymbol,
      targetTokenSymbol,
      state,
      description: state === 'active' ? description : undefined
    };
  });
}
